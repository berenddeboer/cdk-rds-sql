import { PostgresqlEngine } from "./engine.postgresql"

describe("PostgreSQL Engine", () => {
  let engine: PostgresqlEngine

  beforeEach(() => {
    engine = new PostgresqlEngine()
  })

  describe("Role", () => {
    it("should generate SQL to revoke privileges on old database when database is changed", async () => {
      // Mock getPassword implementation
      jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

      const oldProps = {
        DatabaseName: "olddb",
        PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
      }

      const newProps = {
        DatabaseName: "newdb",
        PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
      }

      const sql = await engine.updateRole("testrole", "testrole", newProps, oldProps)

      expect(Array.isArray(sql)).toBe(true)

      // Check for transaction start
      expect(sql[0]).toBe("start transaction")

      // Find the revoke statement for the old database
      const revokeStatement = sql.find(
        (statement) =>
          statement.includes("revoke connect on database") && statement.includes("olddb")
      )
      expect(revokeStatement).toBeDefined()

      // Check for grant statement for the new database
      const grantStatement = sql.find(
        (statement) =>
          statement.includes("grant connect on database") && statement.includes("newdb")
      )
      expect(grantStatement).toBeDefined()

      // Check for transaction commit
      expect(sql[sql.length - 1]).toBe("commit")
    })
  })

  // Add basic tests for other PostgreSQL functionality
  describe("Database", () => {
    it("should generate correct SQL for creating a database", () => {
      const sql = engine.createDatabase("testdb", {})
      expect(sql).toContain('create database "testdb"')
    })
  })

  describe("SQL", () => {
    it("should pass through SQL statements", () => {
      const statement = "SELECT * FROM users"
      const sql = engine.createSql("test", { Statement: statement })
      expect(sql).toBe(statement)
    })
  })
})
