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

    describe("IAM Authentication", () => {
      it("should create role with IAM authentication", async () => {
        const props = {
          EnableIamAuth: true,
          DatabaseName: "testdb",
        }

        const sql = await engine.createRole("iamrole", props)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toBe("start transaction")
        expect(sql).toContain('create role iamrole with login')
        expect(sql).toContain('grant rds_iam to iamrole')
        expect(sql[sql.length - 1]).toBe("commit")
      })

      it("should create role without IAM authentication", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const props = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
          DatabaseName: "testdb",
        }

        const sql = await engine.createRole("passwordrole", props)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toBe("start transaction")
        expect(sql).toContain('create role passwordrole with login password \'test-password\'')
        expect(sql[sql.length - 1]).toBe("commit")
      })

      it("should switch from password to IAM authentication", async () => {
        const oldProps = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
        }

        const newProps = {
          EnableIamAuth: true,
        }

        const sql = await engine.updateRole("switchrole", "switchrole", newProps, oldProps)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toBe("start transaction")
        expect(sql).toContain('grant rds_iam to switchrole')
        expect(sql[sql.length - 1]).toBe("commit")
      })

      it("should switch from IAM to password authentication", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("new-password")

        const oldProps = {
          EnableIamAuth: true,
        }

        const newProps = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
        }

        const sql = await engine.updateRole("switchrole", "switchrole", newProps, oldProps)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toBe("start transaction")
        expect(sql).toContain('revoke rds_iam from switchrole')
        expect(sql).toContain('alter role switchrole with password \'new-password\'')
        expect(sql[sql.length - 1]).toBe("commit")
      })
    })
  })

  // Add basic tests for other PostgreSQL functionality
  describe("Database", () => {
    it("should generate correct SQL for creating a database", () => {
      const sql = engine.createDatabase("testdb", {})
      expect(sql).toContain('create database testdb')
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
