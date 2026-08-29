# Coding challenge Aug 2026 (shared with candidates)

Build a small application where a brand uploads a supplier quotation spreadsheet (XLSX), the system parses it into structured data, uses that as a baseline to negotiate with other suppliers via AI agents, and lets the brand convert the winning negotiation into a Purchase Order. The goal is to find the best deal across suppliers based on cost, quality, lead time, and payment terms — explain the decision, and let the brand commit to it.

## Scenario

A brand sourcing manager received a quotation spreadsheet from one of their suppliers. They upload it into the system, which parses the messy file, extracts the quoted products and pricing, and uses it as leverage to negotiate with the other suppliers. Once the brand picks a winner, they convert that negotiation into a Purchase Order that gets tracked alongside their other POs.

## Flow

1. Brand user uploads a supplier quotation XLSX file
2. System parses it and matches the parsed items against the product catalog (provided as `products.csv`)
3. The brand AI agent uses the parsed quote as a baseline and initiates negotiations with the supplier agents
4. Negotiation between brand agent and each supplier agent
5. Brand agent selects the best supplier and explains the reasoning
6. Brand user converts the winning negotiation into a Purchase Order
7. PO appears in a list of all POs the brand has issued

## Quotation Spreadsheet

- Provided as XLSX files (attached)
- The layout is messy: merged cells, inconsistent headers, mixed formatting
- We will test your solution with a **different quotation spreadsheet not provided here** — your parser should be robust, not hardcoded to these specific files

## Product Catalog

- Provided in the `products.csv` file (attached)
- This is the source of truth — parsed quotation items must be matched against it
- Some SKUs in the spreadsheet may contain typos

## Suppliers

- Supplier 1 (supplier that provided the initial quotation from the uploaded XLSX): Medium quality (4.0) / Cheapest / Lead time: 50 days / Payment terms: 33/33/33
- Supplier 2 (simulated agent): High quality (4.7) / Most expensive / Lead time: 25 days / Payment terms: 40/60
- Supplier 3 (simulated agent): Medium quality (4.0) / Mid-range price / Lead time: 15 days / Payment terms: 100% upfront

## AI Agents

- **Brand Agent**: The main AI agent. After the quotation is parsed, it uses the extracted data as negotiation leverage and talks to each supplier agent to get the best deal.
    - The brand agent is aware of each supplier's quality ratings
- **Supplier Agents**: Each supplier has its own AI agent simulating the supplier side of the negotiation.
    - Supplier agents should behave realistically — suppliers don't just accept or reject, they find ways to win the deal
    - Materials and data does not need to be real items — made up ones are fine as long as they make sense in context
- Agents should communicate in English using natural language

## Mid-Negotiation Change

After the first round of negotiation completes, the system should handle a curveball: **"Supplier 2 came back saying they can only fulfill 60% of the order. Re-evaluate."**

Your system should incorporate this new information and adjust the negotiation strategy without restarting from scratch.

## Purchase Orders

Once the brand agent recommends a winning supplier, the brand user can **convert that negotiation into a Purchase Order**.

- A PO captures the agreed terms: supplier, line items, quantities, unit prices, total, lead time, payment terms
- The UI should show a **list of all POs** the brand has issued, with their status and the negotiation they came from
- Converting a negotiation into a PO is a real commit action — in a production system this would trigger downstream effects (notifying the supplier, locking inventory, kicking off payment workflows). Treat it that way.

## Expected Deliverables

Estimated work time: 14-20 hours of focused work

- [ ]  Source code + instructions to run (GitHub repo)
- [ ]  UI where the user can upload a quotation XLSX to start the process
    - [ ]  Let the user add an open text note to guide the negotiating agent with constraints (e.g., "prioritize lead time over cost", "30 day deadline", etc)
    - [ ]  UI should show the process and the outcome, with the reasoning behind it
    - [ ]  UI should let the user convert the winning negotiation into a PO, and show a list of all POs
- [ ]  Provide a ~10 minute video (Loom, Cap, etc.) where you present/explain your output, switching between UI and code
- [ ]  1 hour interview session (Google Meet) where we go over your output together and ask follow-up questions, dividing into code

## AI Models

Feel free to use any model that you would like.

## Notes

AI-assisted coding is expected and encouraged. We want to see how effectively you leverage AI tools to move fast while maintaining code quality. You are expected to understand and explain every aspect of the code.
