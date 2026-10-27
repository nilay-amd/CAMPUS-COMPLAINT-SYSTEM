"""
Autonomous SLA Watchdog Agent for CampusCare AI.
Runs in a background thread and periodically monitors active complaints.
If a deadline approaches or is breached, the agent autonomously escalates the ticket.
"""

import threading
import time
from datetime import datetime, timezone
try:
    from . import database as db
except ImportError:
    import database as db

_running = False
_thread = None

def check_and_escalate():
    """Evaluates active complaints against guaranteed SLA targets."""
    now = datetime.now(timezone.utc)
    now_str = now.isoformat()

    active_tickets = db.list_tickets(status="Pending") + db.list_tickets(status="Assigned")
    for t in active_tickets:
        due_at_str = t.get("due_at")
        if not due_at_str:
            continue

        try:
            due_at = datetime.fromisoformat(due_at_str)
            if now > due_at and t.get("status") != "Escalated":
                # Autonomously escalate overdue ticket
                with db.get_connection() as conn:
                    cursor = conn.cursor()
                    cursor.execute("""
                        UPDATE tickets 
                        SET status = 'Escalated', updated_at = ?
                        WHERE id = ?
                    """, (now_str, t["id"]))

                    cursor.execute("""
                        INSERT INTO events (ticket_id, actor, action, detail, created_at)
                        VALUES (?, 'SLA_WATCHDOG_AGENT', 'AUTONOMOUS_ESCALATION', 
                                'SLA breach detected. Escalated to Hostel Warden / Dean.', ?)
                    """, (t["id"], now_str))
                    conn.commit()
                print(f"[SLA Watchdog] Ticket {t['id']} automatically escalated to Warden/Dean.")
        except Exception as e:
            print(f"[SLA Watchdog Error] {e}")

def _loop(interval_seconds: int = 60):
    global _running
    while _running:
        try:
            check_and_escalate()
        except Exception as e:
            print(f"[Watchdog Loop Error] {e}")
        time.sleep(interval_seconds)

def start_sla_watchdog():
    """Starts the background monitoring loop."""
    global _running, _thread
    if _running:
        return
    _running = True
    _thread = threading.Thread(target=_loop, args=(60,), daemon=True)
    _thread.start()
    print("[CampusCare Backend] SLA Watchdog Agent background loop started.")

def stop_sla_watchdog():
    """Stops the background monitoring loop."""
    global _running
    _running = False
