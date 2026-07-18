# Databricks notebook source
# MAGIC %md
# MAGIC # Bronze Ingestion: Tiller Financial Data
# MAGIC
# MAGIC Reads raw data from the Tiller Google Sheet and lands it as-is into Bronze Delta tables.
# MAGIC No transformations are applied here — Bronze is a faithful snapshot of the source.
# MAGIC Type casting, cleaning, and business logic belong in Silver.
# MAGIC
# MAGIC | Table | Source Sheet | Description |
# MAGIC |---|---|---|
# MAGIC | `bronze.transactions_raw` | Transactions | All transaction rows since account connection |
# MAGIC | `bronze.categories_raw` | Categories | Category reference data and monthly budgets |
# MAGIC | `bronze.balance_history_raw` | Balance History | Daily account balance snapshots per account |
# MAGIC
# MAGIC **Schedule:** Daily  
# MAGIC **Write mode:** Overwrite — each sync is a full snapshot of the source sheet

# COMMAND ----------

# MAGIC %md
# MAGIC ## Install Dependencies

# COMMAND ----------

# MAGIC %pip install gspread google-auth

# COMMAND ----------

# MAGIC %md
# MAGIC ## Retrieve Credentials
# MAGIC
# MAGIC Credentials are stored as a Unity Catalog Secret in `personal_budgeting.bronze`.
# MAGIC The secret value is the full service account JSON key downloaded from Google Cloud Console.
# MAGIC UC secrets use `catalog`/`schema`/`key` parameters — not the legacy `scope`/`key` pattern.

# COMMAND ----------

import json

# Retrieve the service account JSON from Unity Catalog Secrets
# UC secrets use catalog/schema/key, not scope/key like legacy workspace secrets
key_json = dbutils.secrets.get(
    catalog="personal_budgeting",
    schema="bronze",
    key="google-sheets-key"
)

# Parse the JSON string into a dict for the auth library
creds_dict = json.loads(key_json)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Authenticate and Connect
# MAGIC
# MAGIC Uses a Google service account with read-only scopes.
# MAGIC The service account email must be shared as a Viewer on the Tiller Google Sheet.
# MAGIC
# MAGIC **Spreadsheet:** Kat and Edgar Damian's Tiller Spreadsheet  
# MAGIC **ID:** `1wq3swEY1vPMpfBCsMjAb_PrFhLA9lbGs5V0MOCNDZNE`

# COMMAND ----------

import gspread
from google.oauth2.service_account import Credentials

# Read-only scopes — this pipeline never writes back to the sheet
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly"
]

# Build credentials from the service account dict
# from_service_account_info avoids writing key material to disk
creds = Credentials.from_service_account_info(creds_dict, scopes=SCOPES)
gc = gspread.authorize(creds)

# Open the Tiller sheet by its ID
# ID is the segment between /d/ and /edit in the Google Sheets URL
SPREADSHEET_ID = "1wq3swEY1vPMpfBCsMjAb_PrFhLA9lbGs5V0MOCNDZNE"
sh = gc.open_by_key(SPREADSHEET_ID)

print(f"Connected to: {sh.title}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read Source Sheets into Pandas
# MAGIC
# MAGIC ### Transactions and Categories
# MAGIC `get_all_records()` reads a sheet and returns a list of dicts where keys are the header row.
# MAGIC This maps directly to a Pandas DataFrame.
# MAGIC
# MAGIC ### Balance History
# MAGIC The Balance History sheet has a blank Column A (a Tiller formatting artifact) which causes
# MAGIC `get_all_records()` to throw a duplicate header error. We use `get_all_values()` instead,
# MAGIC which returns raw rows as lists with no header parsing. We then manually assign headers,
# MAGIC drop the blank column, and filter out empty rows before building the DataFrame.
# MAGIC
# MAGIC **Note on formatting:** gspread returns display-formatted values by default (e.g. `$3,435.77`, `7/17/26`).
# MAGIC All columns are cast to string here — Silver is responsible for stripping formatting and casting
# MAGIC to proper types.

# COMMAND ----------

import pandas as pd

# --- Transactions and Categories via get_all_records() ---
transactions_pd = pd.DataFrame(
    sh.worksheet("Transactions").get_all_records()
)

categories_pd = pd.DataFrame(
    sh.worksheet("Categories").get_all_records()
)

# --- Balance History via get_all_values() ---
# Balance History has a blank Column A (Tiller formatting artifact).
# get_all_records() throws a duplicate header error on blank column names.
# get_all_values() returns raw rows as lists — no header parsing, no duplicate check.
raw_balance_history = sh.worksheet("Balance History").get_all_values()

# Row 0 is the header: ['', 'Date', 'Time', 'Account', 'Account #', ...]
# Replace the blank Column A header with 'row_marker' so we can drop it cleanly
headers = raw_balance_history[0]
clean_headers = ['row_marker' if h == '' else h for h in headers]

# Build DataFrame from data rows (skip header row)
balances_pd = pd.DataFrame(raw_balance_history[1:], columns=clean_headers)

# Drop the blank Column A — it's a Tiller formatting artifact with no data
balances_pd = balances_pd.drop(columns=['row_marker'], errors='ignore')

# Drop empty rows — blank rows at the bottom of the sheet come through as all-empty strings
balances_pd = balances_pd[balances_pd['Date'] != '']

print(f"Transactions:    {len(transactions_pd)} rows, {len(transactions_pd.columns)} columns")
print(f"Categories:      {len(categories_pd)} rows, {len(categories_pd.columns)} columns")
print(f"Balance History: {len(balances_pd)} rows, {len(balances_pd.columns)} columns")
print(f"\nBalance History headers: {list(balances_pd.columns)}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Convert to Spark, Clean Column Names, Add Metadata
# MAGIC
# MAGIC ### Why cast everything to string first?
# MAGIC gspread returns Python native types — a column like `Amount` may have numeric values
# MAGIC for most rows but empty strings `""` for blank cells. Pandas infers the column as `object`
# MAGIC (mixed type), and Spark refuses to create a DataFrame from an ambiguous schema.
# MAGIC Casting to string before creating Spark DataFrames sidesteps this entirely.
# MAGIC Silver handles all type casting intentionally.
# MAGIC
# MAGIC ### Why clean column names in Bronze?
# MAGIC Delta Lake follows Parquet naming conventions — no spaces, special characters, or empty strings.
# MAGIC Renaming here means Silver and Gold can reference columns consistently without defensive logic.
# MAGIC
# MAGIC ### Audit columns
# MAGIC `_ingested_at` and `_source` are Bronze-layer metadata prefixed with `_` to distinguish
# MAGIC them from business fields. They are carried through to Silver and available for lineage tracking.

# COMMAND ----------

from pyspark.sql.functions import current_timestamp, lit

def clean_column_names(df):
    """
    Sanitizes DataFrame column names for Delta Lake compatibility.
    Delta Lake / Parquet disallow spaces, special characters, and empty strings.
    Applied in Bronze before writing — type casting happens in Silver.
    """
    renamed = {}
    for col_name in df.columns:
        if col_name == "":
            renamed[col_name] = "row_index"
        else:
            renamed[col_name] = (
                col_name
                .replace(" ", "_")
                .replace("#", "num")
                .replace("&", "and")
                .replace("-", "_")
                .lower()
            )
    for old, new in renamed.items():
        df = df.withColumnRenamed(old, new)
    return df

# Cast all columns to string — Bronze lands raw strings, Silver casts to proper types
transactions_pd  = transactions_pd.astype(str)
categories_pd    = categories_pd.astype(str)
balances_pd      = balances_pd.astype(str)

# Convert to Spark DataFrames
transactions_spark = spark.createDataFrame(transactions_pd)
categories_spark   = spark.createDataFrame(categories_pd)
balances_spark     = spark.createDataFrame(balances_pd)

# Clean column names for Delta Lake compatibility
transactions_spark = clean_column_names(transactions_spark)
categories_spark   = clean_column_names(categories_spark)
balances_spark     = clean_column_names(balances_spark)

# Add Bronze audit columns — pipeline metadata, not source data
# Prefixed with _ to distinguish from business fields
transactions_spark = transactions_spark \
    .withColumn("_ingested_at", current_timestamp()) \
    .withColumn("_source", lit("tiller_google_sheets"))

categories_spark = categories_spark \
    .withColumn("_ingested_at", current_timestamp()) \
    .withColumn("_source", lit("tiller_google_sheets"))

balances_spark = balances_spark \
    .withColumn("_ingested_at", current_timestamp()) \
    .withColumn("_source", lit("tiller_google_sheets"))

print("DataFrames ready")
print(f"  transactions_spark:  {transactions_spark.count()} rows, {len(transactions_spark.columns)} columns")
print(f"  categories_spark:    {categories_spark.count()} rows, {len(categories_spark.columns)} columns")
print(f"  balances_spark:      {balances_spark.count()} rows, {len(balances_spark.columns)} columns")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write to Bronze Delta Tables
# MAGIC
# MAGIC **Why overwrite instead of append?**  
# MAGIC All three Tiller sheets are full snapshots — every sync contains the complete current state,
# MAGIC not just new rows. Appending would create duplicates. Deduplication logic (using `transaction_id`
# MAGIC as the natural key for transactions, and `balance_id` for balance history) belongs in Silver.
# MAGIC
# MAGIC **`overwriteSchema=true`**  
# MAGIC Allows the table schema to evolve if Tiller adds columns to the source sheet.
# MAGIC Without this, a schema change would cause the job to fail.

# COMMAND ----------

transactions_spark.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.bronze.transactions_raw")

categories_spark.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.bronze.categories_raw")

balances_spark.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable("personal_budgeting.bronze.balance_history_raw")

print("Bronze tables written successfully")
print(f"  transactions_raw:     {transactions_spark.count()} rows")
print(f"  categories_raw:       {categories_spark.count()} rows")
print(f"  balance_history_raw:  {balances_spark.count()} rows")