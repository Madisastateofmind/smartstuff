import sqlite3, pathlib, unittest

class CountingTests(unittest.TestCase):
    def test_launch_is_not_counted_twice_by_heartbeats(self):
        db=sqlite3.connect(":memory:")
        db.executescript(pathlib.Path("schema.sql").read_text())
        insert="INSERT INTO daily(app,source,day,launches) SELECT ?,?,?,1 WHERE NOT EXISTS(SELECT 1 FROM sessions WHERE app=? AND source=? AND sid=?) ON CONFLICT(app,source,day) DO UPDATE SET launches=launches+1"
        heartbeat="INSERT INTO sessions(app,source,sid,seen) VALUES(?,?,?,?) ON CONFLICT(app,source,sid) DO UPDATE SET seen=excluded.seen"
        def event(source,sid,day,seen):
            with db:
                db.execute(insert,("wct",source,day,"wct",source,sid))
                db.execute(heartbeat,("wct",source,sid,seen))
        event("web","one","2026-10-14",1)
        event("web","one","2026-10-14",2)
        event("web","one","2026-10-15",3)
        self.assertEqual(db.execute("SELECT SUM(launches) FROM daily").fetchone()[0],1)
        event("web","two","2026-10-15",4)
        event("discord","three","2026-10-15",5)
        self.assertEqual(db.execute("SELECT SUM(launches) FROM daily").fetchone()[0],3)
        self.assertEqual(db.execute("SELECT COUNT(*) FROM sessions WHERE source='discord'").fetchone()[0],1)
        self.assertEqual(db.execute("SELECT seen FROM sessions WHERE sid='one'").fetchone()[0],3)

if __name__ == "__main__":
    unittest.main()
