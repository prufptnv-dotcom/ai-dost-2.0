/**
 * dataAnalyticsEngine.js
 * 2030 Executive Data Science, Analytics & Visualization Engine for AI-Dost
 * Category 8: Data Analysis aur Visualization
 *
 * Implements all 13 Data Capabilities:
 *  1. CSV/Excel analysis
 *  2. Data cleaning & hygiene
 *  3. Missing values analysis & imputation
 *  4. Statistical summary (Mean, Median, Std, Quartiles, Skewness)
 *  5. Correlation analysis & matrix
 *  6. Trend & seasonality analysis
 *  7. Modern Charts (Bar, Line, Area, Scatter, Pie, Heatmap, Radar, Candlestick)
 *  8. Forecasting concepts (ARIMA, Prophet, Exponential Smoothing, Moving Averages)
 *  9. Production SQL queries (Window functions, CTEs, Aggregations, Indexing)
 * 10. Pandas & Polars code (Vectorization, LazyFrames, GroupBy, Pivots)
 * 11. Dashboard architecture & layout planning
 * 12. Modern Data Pipeline design (ETL/ELT, Lakehouse, dbt, Airflow, Kafka)
 * 13. KPI & North Star metric analysis
 */

const ExcelJS = require('exceljs');
const Papa = require('papaparse');
const logger = require('../logger');

// ── 1. Deterministic Statistical Analysis ───────────────────────────────────

/**
 * Computes deep descriptive statistics, missing values, and column profiles
 */
function computeDatasetProfile(rows, columns) {
  if (!rows || rows.length === 0 || !columns || columns.length === 0) {
    return { totalRows: 0, totalColumns: 0, columnProfiles: {}, missingOverview: {} };
  }

  const totalRows = rows.length;
  const columnProfiles = {};
  let totalMissingCells = 0;

  columns.forEach((col) => {
    let nonNullCount = 0;
    let numericValues = [];
    const distinctSet = new Set();

    rows.forEach((r) => {
      const val = r[col];
      if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).toLowerCase() !== 'nan' && String(val).toLowerCase() !== 'null') {
        nonNullCount++;
        distinctSet.add(val);
        const num = Number(val);
        if (!isNaN(num) && typeof val !== 'boolean') {
          numericValues.push(num);
        }
      }
    });

    const missingCount = totalRows - nonNullCount;
    totalMissingCells += missingCount;
    const missingPct = Number(((missingCount / totalRows) * 100).toFixed(2));
    const isNumeric = numericValues.length > totalRows * 0.7 && numericValues.length > 0;

    const profile = {
      name: col,
      type: isNumeric ? 'numeric' : 'categorical',
      nonNullCount,
      missingCount,
      missingPct,
      distinctCount: distinctSet.size,
    };

    if (isNumeric && numericValues.length > 0) {
      numericValues.sort((a, b) => a - b);
      const n = numericValues.length;
      const sum = numericValues.reduce((acc, v) => acc + v, 0);
      const mean = sum / n;
      const variance = numericValues.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / (n > 1 ? n - 1 : 1);
      const stdDev = Math.sqrt(variance);

      profile.stats = {
        min: numericValues[0],
        max: numericValues[n - 1],
        mean: Number(mean.toFixed(2)),
        median: n % 2 === 1 ? numericValues[Math.floor(n / 2)] : Number(((numericValues[n / 2 - 1] + numericValues[n / 2]) / 2).toFixed(2)),
        stdDev: Number(stdDev.toFixed(2)),
        q1: numericValues[Math.floor(n * 0.25)],
        q3: numericValues[Math.floor(n * 0.75)],
      };
    } else {
      // Top frequent values for categoricals
      const freqMap = {};
      rows.forEach((r) => {
        const val = String(r[col] || '').trim();
        if (val) freqMap[val] = (freqMap[val] || 0) + 1;
      });
      const sortedFreq = Object.entries(freqMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
      profile.topCategories = sortedFreq.map(([cat, cnt]) => ({ category: cat, count: cnt, pct: Number(((cnt / totalRows) * 100).toFixed(1)) }));
    }

    columnProfiles[col] = profile;
  });

  return {
    totalRows,
    totalColumns: columns.length,
    totalCells: totalRows * columns.length,
    totalMissingCells,
    overallMissingPct: Number(((totalMissingCells / (totalRows * columns.length)) * 100).toFixed(2)),
    columnProfiles,
  };
}

// ── 2. Excel (.xlsx) Parser for Datasets ────────────────────────────────────

async function parseExcelBuffer(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const firstSheet = wb.worksheets[0];
  if (!firstSheet) throw new Error('Excel workbook contains no sheets.');

  const rows = [];
  let headers = [];

  firstSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (rowNumber === 1) {
      headers = values.map((v) => String(v || '').trim()).filter(Boolean);
    } else {
      const rowObj = {};
      headers.forEach((h, idx) => {
        let cellVal = values[idx];
        if (cellVal !== null && typeof cellVal === 'object') {
          cellVal = cellVal.result !== undefined ? cellVal.result : cellVal.text !== undefined ? cellVal.text : JSON.stringify(cellVal);
        }
        rowObj[h] = cellVal !== undefined ? cellVal : '';
      });
      rows.push(rowObj);
    }
  });

  return { rows, columns: headers, sheetName: firstSheet.name };
}

// ── 3. Category 8 System Directives & Prompt Architecture ───────────────────

const DATA_ANALYTICS_STUDIO_DIRECTIVE = `
### 13. 2030 DATA ANALYSIS, SCIENCE & VISUALIZATION PROTOCOL (CATEGORY 8):
When the user requests data analysis, statistics, data cleaning, queries, code, or visualization:

══════════════════════════════════════════════════════════════════════════════
13 CORE DATA SCIENCE & ANALYTICS DOMAINS:
══════════════════════════════════════════════════════════════════════════════

1. 📊 CSV & EXCEL DEEP ANALYSIS:
   - Provide dataset shape (rows x cols), memory footprint, column data types, distribution insights, and domain-specific inferences.

2. 🧹 DATA CLEANING & HYGIENE:
   - Identify: duplicate rows, leading/trailing whitespace, inconsistent casing, invalid phone/email regex, outliers using IQR (Q1 - 1.5*IQR to Q3 + 1.5*IQR), and date format inconsistencies.
   - Provide concrete code to clean and normalize the dataset.

3. 🔍 MISSING VALUES ANALYSIS & IMPUTATION:
   - Report exact null count and percentage per column.
   - Recommend statistically sound imputation:
     - Numerical: Mean (normal), Median (skewed), or MICE / KNN Imputer.
     - Categorical: Mode or dedicated 'Unknown' class.
     - Time Series: Forward Fill (ffill), Backward Fill (bfill), or Linear Interpolation.

4. 📈 STATISTICAL SUMMARY:
   - Generate full 5-number summary: Min, Q1 (25%), Median (50%), Q3 (75%), Max.
   - Include Mean, Variance, Standard Deviation, Interquartile Range (IQR), and Skewness analysis.

5. 🔗 CORRELATION ANALYSIS:
   - Identify strong positive (r > 0.7), strong negative (r < -0.7), and zero-correlation pairs.
   - Warn against confounding variables and multicollinearity (VIF > 5).
   - Provide ASCII / Markdown correlation matrix.

6. 📉 TREND & TIME-SERIES ANALYSIS:
   - Identify overall trajectory: Upward trend, Downward trend, or Mean-reverting.
   - Highlight seasonality (weekly, monthly, quarterly cyclicality) and anomaly spikes.

7. 📊 MODERN 2030 CHARTS & VISUALIZATIONS:
   - When returning chart recommendations, output clean JSON compatible with Chart.js / Recharts:
     \`\`\`json
     {
       "chartType": "bar" | "line" | "area" | "pie" | "scatter" | "radar",
       "title": "Clean Descriptive Chart Title",
       "xAxis": "Dimension Name",
       "yAxis": "Metric Name",
       "data": [{ "name": "...", "value": 123 }, ...]
     }
     \`\`\`

8. 🔮 FORECASTING CONCEPTS & BLUEPRINT:
   - Outline the mathematical approach:
     - Short-term: Simple / Exponential Moving Averages (EMA).
     - Mid-term: Holt-Winters Exponential Smoothing, ARIMA(p, d, q) with stationarity checks (ADF test).
     - Modern ML: Meta Prophet, XGBoost with lag features, LSTM / DeepAR for high-dimensional time series.

9. 🐬 PRODUCTION-GRADE SQL QUERIES:
   - Write clean, formatted, production-ready SQL:
     - Use Common Table Expressions (CTEs) instead of nested subqueries for readability.
     - Leverage Window Functions: \`ROW_NUMBER()\`, \`DENSE_RANK()\`, \`LAG()\`, \`LEAD()\`, \`SUM() OVER (PARTITION BY ... ORDER BY ...)\`.
     - Recommend proper index structures (\`CREATE INDEX idx_col ON tbl(col)\`).

10. 🐼 PANDAS & POLARS CODE:
    - Provide idiomatic, vectorized, high-performance code:
      - Pandas: Avoid \`.iterrows()\`, use vectorization, \`.groupby().agg()\`, \`.assign()\`.
      - Polars: Use fast LazyFrame syntax (\`pl.scan_csv()\`, \`.filter()\`, \`.select()\`, \`.group_by()\`, \`.collect()\`).

11. 📱 DASHBOARD ARCHITECTURE & LAYOUT PLANNING:
    - Structure an executive dashboard grid:
      - Top Banner: 4 Primary KPI Summary Cards (Current Value, MoM Delta %, Sparkline).
      - Main Panel: Primary Time-Series Trend Line + Cohort Heatmap.
      - Secondary Panel: Category Breakdown Bar / Donut Chart + Anomaly Alerts.
      - Filters: Date range picker, Segment dropdown, Region selector.

12. 🏗️ MODERN DATA PIPELINE DESIGN:
    - Design scalable ETL / ELT architectures:
      - Ingestion: Apache Kafka / Debezium (CDC) / AWS Kinesis.
      - Transformation: dbt (Data Build Tool) with Bronze $\to$ Silver $\to$ Gold Lakehouse model.
      - Storage / OLAP: Snowflake, Google BigQuery, ClickHouse, or DuckDB.
      - Orchestration: Apache Airflow, Dagster, or Prefect.

13. 🎯 KPI & NORTH STAR METRIC FRAMEWORK:
    - Map out essential domain metrics:
      - SaaS: ARR, MRR, Net Retention Rate (NRR > 110%), Churn Rate, LTV/CAC ratio (> 3x), Magic Number.
      - E-Commerce: GMV, AOV (Average Order Value), CAC, Cart Abandonment Rate, Repeat Purchase Rate.
      - Product / Apps: DAU/MAU stickiness, Retention curve (Day 1, Day 7, Day 30), Feature Adoption.
`;

/**
 * Detects if user query is seeking Category 8 Data Science & Analytics
 */
function detectDataAnalyticsIntent(message) {
  const text = String(message || '').toLowerCase();

  const isAnalytics = /\b(data analysis|analytics|csv|excel|dataset|pandas|polars|sql query|sql queries|data cleaning|missing values|imputation|statistics|mean|median|std dev|correlation|trend analysis|forecast|forecasting|arima|prophet|dashboard|data pipeline|etl|elt|kpi|metrics|chart|bar chart|line chart|pie chart|scatter plot)\b/i.test(text);

  let specificDomain = 'general-analytics';
  if (/\b(?:sql|query|queries|select|from|join|where|cte|window function)\b/i.test(text)) specificDomain = 'sql-queries';
  else if (/\b(?:pandas|polars|dataframe|series|groupby|pivot)\b/i.test(text)) specificDomain = 'pandas-polars';
  else if (/\b(?:clean|cleaning|hygiene|outliers?|duplicates?|missing|impute|imputation)\b/i.test(text)) specificDomain = 'data-cleaning';
  else if (/\b(?:forecast|forecasting|arima|prophet|time series|moving average)\b/i.test(text)) specificDomain = 'forecasting';
  else if (/\b(?:dashboard|kpi|metrics|north star|arr|mrr|ltv|cac)\b/i.test(text)) specificDomain = 'dashboard-kpi';
  else if (/\b(?:pipeline|etl|elt|lakehouse|dbt|airflow|kafka)\b/i.test(text)) specificDomain = 'data-pipeline';
  else if (/\b(?:chart|graph|plot|visualiz(?:e|ation)|bar chart|line chart|scatter)\b/i.test(text)) specificDomain = 'visualization';
  else if (/\b(?:statist(?:ic|ical)|mean|median|mode|standard deviation|variance|quartile)\b/i.test(text)) specificDomain = 'statistics';

  return {
    isAnalytics,
    domain: specificDomain,
  };
}

module.exports = {
  computeDatasetProfile,
  parseExcelBuffer,
  DATA_ANALYTICS_STUDIO_DIRECTIVE,
  detectDataAnalyticsIntent,
};
