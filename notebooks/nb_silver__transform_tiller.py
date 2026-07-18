# Databricks notebook source
# MAGIC %md
# MAGIC # Silver Transform: Tiller Financial Data
# MAGIC
# MAGIC Reads from Bronze Delta tables, applies type casting, deduplication, and structural transforms.
# MAGIC Produces four Silver tables:
# MAGIC
# MAGIC | Table | Description | Grain |
# MAGIC |---|---|---|
# MAGIC | `silver.categories` | Category reference data | One row per category |
# MAGIC | `silver.budget` | Budget amounts, unpivoted wide → long | One row per category per month |
# MAGIC | `silver.transactions` | Cleaned, typed, deduplicated transactions | One row per transaction |
# MAGIC | `silver.balance_history` | Cleaned, typed account balance snapshots | One row per balance snapshot |
# MAGIC
# MAGIC **Depends on:** `bronze.transactions_raw`, `bronze.categories_raw`, `bronze.balance_history_raw`
# MAGIC
# MAGIC ### Date formats observed in Bronze
# MAGIC | Column | Raw Format | Example | Appears in |
# MAGIC |---|---|---|---|
# MAGIC | `date` (transactions) | `M/d/yyyy` | `7/17/2026` | transactions |
# MAGIC | `month`, `date_added`, `categorized_date` | `M/d/yy` | `7/17/26` | transactions |
# MAGIC | `date`, `month`, `week` | `M/d/yy` | `7/17/26` | balance_history |
# MAGIC | `date_added` | `M/d/yyyy` | `7/17/2026` | balance_history |
# MAGIC
# MAGIC ### Amount/balance formatting
# MAGIC gspread returns display-formatted values. Currency columns include `$` and `,` (e.g. `-$2,560.00`, `$3,435.77`).
# MAGIC These are stripped with `regexp_replace` before casting to `DecimalType`.

# COMMAND ----------

# MAGIC %md
# MAGIC ## Setup
# MAGIC
# MAGIC Create the Silver schema and define helper functions used across all transforms.

# COMMAND ----------

from pyspark.sql.functions import col, when, trim

# Create Silver schema if it doesn't exist
spark.sql("CREATE SCHEMA IF NOT EXISTS personal_budgeting.silver")

def empty_to_null(df):
    """
    Replace empty strings with null across all string columns.
    gspread returns "" for blank cells — Bronze lands them as-is.
    Silver converts to proper nulls so downstream logic can use isNull() cleanly.
    """
    string_cols = [f.name for f in df.schema.fields
                   if str(f.dataType) == "StringType()"]
    for c in string_cols:
        df = df.withColumn(c, when(trim(col(c)) == "", None).otherwise(col(c)))
    return df

# COMMAND ----------

# MAGIC %md
# MAGIC ## silver.categories
# MAGIC
# MAGIC Reference table for category metadata. Contains category name, group, type, and the
# MAGIC `hide_from_reports` flag which controls whether a category is excluded from Gold aggregations.
# MAGIC This table is joined onto `silver.transactions` to enrich each transaction with its category context.
# MAGIC
# MAGIC **Source:** `bronze.categories_raw`

# COMMAND ----------

categories_silver = (
    spark.table("personal_budgeting.bronze.categories_raw")
    # Only the three core reference columns plus hide_from_reports
    # which is needed to filter report-excluded categories in Gold
    .select("category", "group", "type", "hide_from_reports")
    .transform(empty_to_null)
    # Drop any rows with no category — these are blank sheet rows
    .filter(col("category").isNotNull())
    # Cast hide_from_reports from string "True"/"False" to boolean
    .withColumn(
        "hide_from_reports",
        when(col("hide_from_reports") == "True", True).otherwise(False)
    )
)

categories_silver.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.silver.categories")

print(f"silver.categories: {categories_silver.count()} rows")
categories_silver.show(truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ## silver.budget
# MAGIC
# MAGIC Budget amounts unpivoted from wide format (one column per month) to long format
# MAGIC (one row per category per month). Long format enables a simple join with transactions
# MAGIC aggregated by month in Gold — no dynamic column logic needed.
# MAGIC
# MAGIC **Source:** `bronze.categories_raw`  
# MAGIC **Expected row count:** 35 categories × 12 months = 420 rows
# MAGIC
# MAGIC ### Why unpivot?
# MAGIC The Tiller Categories sheet stores budget amounts in wide format:
# MAGIC
# MAGIC | category | jan_2026 | feb_2026 | ... |
# MAGIC |---|---|---|---|
# MAGIC | Groceries | 400 | 400 | ... |
# MAGIC
# MAGIC Long format makes Gold aggregations straightforward:
# MAGIC
# MAGIC | category | budget_month | budgeted_amount |
# MAGIC |---|---|---|
# MAGIC | Groceries | 2026-01-01 | 400 |
# MAGIC | Groceries | 2026-02-01 | 400 |

# COMMAND ----------

from pyspark.sql.functions import to_date, regexp_replace
from pyspark.sql.types import DecimalType

# Maps Bronze column names to their first-of-month date string
month_map = {
    "jan_2026": "2026-01-01",
    "feb_2026": "2026-02-01",
    "mar_2026": "2026-03-01",
    "apr_2026": "2026-04-01",
    "may_2026": "2026-05-01",
    "jun_2026": "2026-06-01",
    "jul_2026": "2026-07-01",
    "aug_2026": "2026-08-01",
    "sep_2026": "2026-09-01",
    "oct_2026": "2026-10-01",
    "nov_2026": "2026-11-01",
    "dec_2026": "2026-12-01"
}

# Build a SQL stack() expression to unpivot wide month columns into rows.
# stack(n, 'key1', col1, 'key2', col2, ...) AS (key_col, value_col)
# Each key/value pair becomes a row — category stays as the grouping key.
stack_pairs = ", ".join([
    f"'{date}', `{month_col}`"
    for month_col, date in month_map.items()
])
stack_expr = f"stack({len(month_map)}, {stack_pairs}) as (budget_month, budgeted_amount)"

budget_silver = (
    spark.table("personal_budgeting.bronze.categories_raw")
    .select("category", *month_map.keys())
    .transform(empty_to_null)
    .filter(col("category").isNotNull())
    # Unpivot: one row per category per month
    .selectExpr("category", stack_expr)
    # Convert the date string injected via stack() to a proper DateType
    .withColumn("budget_month", to_date(col("budget_month"), "yyyy-MM-dd"))
    # Step 1 — strip currency formatting from the raw string
    # gspread returns formatted display values e.g. $400.00, $0.00
    .withColumn(
        "budgeted_amount",
        regexp_replace(regexp_replace(col("budgeted_amount"), "\\$", ""), ",", "")
    )
    # Step 2 — cast the now-clean string to decimal
    .withColumn("budgeted_amount", col("budgeted_amount").cast(DecimalType(10, 2)))
    # Step 3 — replace nulls (failed casts or blank cells) with 0.00
    .withColumn(
        "budgeted_amount",
        when(col("budgeted_amount").isNull(), 0.00).otherwise(col("budgeted_amount"))
    )
)

budget_silver.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.silver.budget")

print(f"silver.budget: {budget_silver.count()} rows")
budget_silver \
    .filter(col("budgeted_amount") > 0) \
    .orderBy("budget_month", "category") \
    .show(24, truncate=False)

# COMMAND ----------

# MAGIC %md
# MAGIC ## silver.transactions
# MAGIC
# MAGIC Core transactions table. Applies type casting, deduplication on `transaction_id`,
# MAGIC and enrichment from `silver.categories`.
# MAGIC
# MAGIC **Source:** `bronze.transactions_raw`  
# MAGIC **Depends on:** `silver.categories` — run that cell first
# MAGIC
# MAGIC ### Columns dropped
# MAGIC `row_index`, `week`, `account_id`, `check_number`, `category_hint`, `categorized_by`
# MAGIC are not analytically useful and are excluded from Silver.

# COMMAND ----------

from pyspark.sql.functions import to_date, regexp_replace, current_timestamp
from pyspark.sql.types import DecimalType

# Columns to carry forward into Silver
KEEP_COLS = [
    "date", "description", "full_description", "category",
    "amount", "account", "account_num", "institution",
    "month", "transaction_id", "date_added",
    "categorized_date", "source", "_ingested_at"
]

transactions_silver = (
    spark.table("personal_budgeting.bronze.transactions_raw")
    .select(KEEP_COLS)
    .transform(empty_to_null)
    # Deduplicate on transaction_id — natural key from Tiller
    # Keeps first occurrence if duplicates arise across syncs
    .dropDuplicates(["transaction_id"])
    # Cast date columns — note two different raw formats
    # date: full 4-digit year (M/d/yyyy)
    # all others: 2-digit year (M/d/yy)
    .withColumn("date",             to_date(col("date"),             "M/d/yyyy"))
    .withColumn("month",            to_date(col("month"),            "M/d/yy"))
    .withColumn("date_added",       to_date(col("date_added"),       "M/d/yy"))
    .withColumn("categorized_date", to_date(col("categorized_date"), "M/d/yy"))
    # Strip $ and , from amount before casting to decimal
    # e.g. -$2,560.00 → -2560.00 → DecimalType(10,2)
    # Tiller convention: negative = expense, positive = income
    .withColumn(
        "amount",
        regexp_replace(
            regexp_replace(col("amount"), "\\$", ""),
            ",", ""
        ).cast(DecimalType(10, 2))
    )
    # Enrich with group and type from silver.categories
    # Left join preserves uncategorized transactions (null category)
    .join(
        spark.table("personal_budgeting.silver.categories")
            .select("category", "group", "type"),
        on="category",
        how="left"
    )
)

transactions_silver.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.silver.transactions")

print(f"silver.transactions: {transactions_silver.count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## silver.balance_history
# MAGIC
# MAGIC Account balance snapshots. Tiller records a new row each time it syncs an account,
# MAGIC so there are multiple snapshots per account per day. Silver keeps the full history —
# MAGIC Gold uses `row_number()` to window down to the latest balance per account for the
# MAGIC credit card view.
# MAGIC
# MAGIC **Source:** `bronze.balance_history_raw`  
# MAGIC **Natural key:** `balance_id` — unique per snapshot  
# MAGIC
# MAGIC ### Columns dropped
# MAGIC `account_id`: Tiller internal ID not needed downstream.  
# MAGIC `week`: not analytically useful for balance analysis.  
# MAGIC `time`: coarse granularity — date is sufficient for trend analysis.

# COMMAND ----------

from pyspark.sql.functions import to_date, to_timestamp, concat, lit, regexp_replace
from pyspark.sql.types import DecimalType

# Include time in the select so we can build snapshot_at
BALANCE_KEEP_COLS = [
    "date", "time", "account", "account_num", "balance_id",
    "institution", "balance", "month", "type",
    "class", "account_status", "date_added", "_ingested_at"
]

balance_history_silver = (
    spark.table("personal_budgeting.bronze.balance_history_raw")
    .select(BALANCE_KEEP_COLS)
    .transform(empty_to_null)
    .dropDuplicates(["balance_id"])
    # Create snapshot_at BEFORE casting date to DateType
    # Combines "7/17/26" + "12:26 PM" into a proper timestamp
    # Format: M/d/yy h:mm a → handles both 12:26 PM and 9:24 PM correctly
    .withColumn(
        "snapshot_at",
        to_timestamp(concat(col("date"), lit(" "), col("time")), "M/d/yy h:mm a")
    )
    # Cast date columns — after snapshot_at is built from raw strings
    .withColumn("date",       to_date(col("date"),       "M/d/yy"))
    .withColumn("month",      to_date(col("month"),      "M/d/yy"))
    .withColumn("date_added", to_date(col("date_added"), "M/d/yyyy"))
    # Drop raw time string — now captured precisely in snapshot_at
    .drop("time")
    # Strip $ and , from balance before casting to decimal
    .withColumn(
        "balance",
        regexp_replace(
            regexp_replace(col("balance"), "\\$", ""),
            ",", ""
        ).cast(DecimalType(12, 2))
    )
)

balance_history_silver.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.silver.balance_history")

print(f"silver.balance_history: {balance_history_silver.count()} rows")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Validation
# MAGIC
# MAGIC Null checks on key columns to confirm all four transforms landed correctly.
# MAGIC
# MAGIC | Check | Expected |
# MAGIC |---|---|
# MAGIC | `null_transaction_ids` | 0 — Tiller always provides these |
# MAGIC | `null_dates` | 0 — every transaction has a date |
# MAGIC | `null_amounts` | 0 |
# MAGIC | `uncategorized` | Some expected — transactions not yet categorized in Tiller |
# MAGIC | `unmatched_category_type` | 0 — indicates a category in transactions not in silver.categories |
# MAGIC | `null_balance_ids` | 0 — Tiller always provides these |
# MAGIC | `null_balances` | 0 — every snapshot has a balance value |

# COMMAND ----------

from pyspark.sql.functions import count, sum as spark_sum

print("=== silver.transactions — null check ===")
spark.table("personal_budgeting.silver.transactions").select(
    count("*").alias("total_rows"),
    spark_sum(when(col("transaction_id").isNull(), 1).otherwise(0)).alias("null_transaction_ids"),
    spark_sum(when(col("date").isNull(), 1).otherwise(0)).alias("null_dates"),
    spark_sum(when(col("amount").isNull(), 1).otherwise(0)).alias("null_amounts"),
    spark_sum(when(col("category").isNull(), 1).otherwise(0)).alias("uncategorized"),
    spark_sum(when(col("type").isNull(), 1).otherwise(0)).alias("unmatched_category_type")
).show()

print("=== silver.balance_history — null check ===")
spark.table("personal_budgeting.silver.balance_history").select(
    count("*").alias("total_rows"),
    spark_sum(when(col("balance_id").isNull(), 1).otherwise(0)).alias("null_balance_ids"),
    spark_sum(when(col("date").isNull(), 1).otherwise(0)).alias("null_dates"),
    spark_sum(when(col("balance").isNull(), 1).otherwise(0)).alias("null_balances")
).show()

print("=== silver.balance_history — latest snapshot per account ===")
spark.table("personal_budgeting.silver.balance_history") \
    .orderBy(col("date").desc(), col("account")) \
    .select("date", "account", "account_num", "institution", "balance", "type", "class") \
    .limit(10) \
    .show(truncate=False)

print("=== silver.budget — non-zero budgets ===")
spark.table("personal_budgeting.silver.budget") \
    .filter(col("budgeted_amount") > 0) \
    .orderBy("budget_month", "category") \
    .show(10, truncate=False)