"""一次性：把 user_id IS NULL 的 groups 綁給指定 email 的使用者。
用法（該 email 需先 Google 登入過一次）：python bind_owner.py you@example.com
建議在該帳號建立任何自己的分組之前執行。"""
import sys

from db import get_conn


def main(email: str) -> None:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM auth.users WHERE email = %s", (email,)).fetchone()
        if row is None:
            raise SystemExit(f"auth.users 沒有 {email}——先用該帳號登入一次")
        dup = conn.execute(
            "SELECT g1.name FROM groups g1 JOIN groups g2 ON g1.name = g2.name AND g2.user_id = %s WHERE g1.user_id IS NULL",
            (row["id"],),
        ).fetchall()
        if dup:
            names = ", ".join(d["name"] for d in dup)
            raise SystemExit(f"目標帳號已有同名分組（{names}），先改名或刪除再跑")
        cur = conn.execute("UPDATE groups SET user_id = %s WHERE user_id IS NULL", (row["id"],))
        print(f"bound {cur.rowcount} groups to {email}")


if __name__ == "__main__":
    main(sys.argv[1])
