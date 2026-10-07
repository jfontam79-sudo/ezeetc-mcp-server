---
description: Get a full status check on a specific transaction
allowed-tools:
  - "mcp__plugin_ezeetc_ezeetc__get_transaction_detail"
  - "mcp__plugin_ezeetc_ezeetc__get_transaction_timeline"
  - "mcp__plugin_ezeetc_ezeetc__check_envelope_status"
  - "mcp__plugin_ezeetc_ezeetc__find_loan_officer"
---

# Check Transaction

Run a comprehensive check on a specific transaction:

1. Ask the user which property they want to check (if not provided)
2. Call `get_transaction_detail` for the full picture
3. Call `check_envelope_status` to see DocuSign status
4. Highlight any deadlines within the next 7 days
5. Note any missing information (contacts, emails, documents)

Present everything organized by urgency. If there are action items, list them clearly.
