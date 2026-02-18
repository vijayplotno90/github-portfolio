# Blockchain Payments Ops & Product Console (CEO Demo) — v1

This is a **local, offline** HTML/CSS/JS prototype implementing the BRD v1.1 requirements:
- Command Center (Dashboard)
- Transactions Explorer + roadmap + payload view
- Exceptions Center (Rejects/Returns split) + Playbooks
- Transaction Initiation wizard (Create → Review → Submit)
- Maker-Checker QC queue (QC1/QC2 enforced, ≥ 5,000,000 dual control, reject comment required, evidence required)
- Incidents module
- Accounts module
- Notifications inbox
- Reports generator + CSV exports

## Run
Open `index.html` in Chrome/Edge (double click).

## Storage
- Data: `localStorage`
- Evidence files: `IndexedDB` (browser local, per-machine)

## Key Control Rails
- Maker cannot approve own submission
- Reject requires comment
- Evidence required before submit and before approve
- ≥ 5,000,000 amount routes to QC2 after QC1 approval
