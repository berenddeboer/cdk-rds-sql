import { MysqlEngine } from "./engine.mysql"

describe("MySQL Engine", () => {
  let engine: MysqlEngine

  beforeEach(() => {
    engine = new MysqlEngine()
  })

  describe("Database", () => {
    it("should generate correct SQL for creating a database", () => {
      const sql = engine.createDatabase("testdb", {})
      expect(Array.isArray(sql)).toBe(true)
      expect(sql[0]).toContain("CREATE DATABASE IF NOT EXISTS")
    })

    it("should generate correct SQL for creating a database with an owner", () => {
      const sql = engine.createDatabase("testdb", { Owner: "testuser" })
      expect(Array.isArray(sql)).toBe(true)
      expect(sql[0]).toContain("CREATE DATABASE IF NOT EXISTS")
      expect(sql[1]).toContain("GRANT ALL PRIVILEGES")
    })

    it("should generate correct SQL for deleting a database", () => {
      const sql = engine.deleteDatabase("testdb", "masteruser")
      expect(Array.isArray(sql)).toBe(true)
      expect(sql[0]).toContain("DROP DATABASE IF EXISTS")
    })
  })

  describe("Role", () => {
    it("should throw error when creating a role without password ARN", async () => {
      await expect(engine.createRole("testrole", {})).rejects.toThrow(
        "No PasswordArn provided"
      )
    })

    it("should generate correct SQL for renaming a role", async () => {
      // Mock getPassword implementation
      jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

      const sql = await engine.updateRole(
        "newrole",
        "oldrole",
        {
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
        },
        {}
      )

      expect(Array.isArray(sql)).toBe(true)
      expect(sql[0]).toContain("CREATE USER IF NOT EXISTS")
      expect(sql[1]).toContain("DROP USER IF EXISTS")
      expect(sql[2]).toContain("FLUSH PRIVILEGES")
    })

    it("should generate correct SQL for deleting a role", () => {
      const sql = engine.deleteRole("testrole", { DatabaseName: "testdb" })
      expect(Array.isArray(sql)).toBe(true)
      expect(sql[0]).toContain("REVOKE ALL PRIVILEGES")
      expect(sql[1]).toContain("DROP USER IF EXISTS")
    })

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

      // Check for revoke statement for the old database
      const revokeStatement = sql.find(
        (statement) =>
          statement.includes("REVOKE ALL PRIVILEGES") && statement.includes("`olddb`")
      )
      expect(revokeStatement).toBeDefined()

      // Check for grant statement for the new database
      const grantStatement = sql.find(
        (statement) =>
          statement.includes("GRANT ALL PRIVILEGES") && statement.includes("`newdb`")
      )
      expect(grantStatement).toBeDefined()
    })

    describe("IAM Authentication", () => {
      it("should create user with IAM authentication", async () => {
        const props = {
          EnableIamAuth: true,
          DatabaseName: "testdb",
        }

        const sql = await engine.createRole("iamuser", props)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toContain(
          "CREATE USER IF NOT EXISTS 'iamuser'@'%' IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'"
        )
        expect(sql[1]).toContain("GRANT ALL PRIVILEGES ON `testdb`.* TO 'iamuser'@'%'")
        expect(sql[2]).toBe("FLUSH PRIVILEGES")
      })

      it("should create user without IAM authentication", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const props = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
          DatabaseName: "testdb",
        }

        const sql = await engine.createRole("passworduser", props)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toContain(
          "CREATE USER IF NOT EXISTS 'passworduser'@'%' IDENTIFIED BY 'test-password'"
        )
        expect(sql[1]).toContain(
          "GRANT ALL PRIVILEGES ON `testdb`.* TO 'passworduser'@'%'"
        )
        expect(sql[2]).toBe("FLUSH PRIVILEGES")
      })

      it("should switch from password to IAM authentication", async () => {
        const oldProps = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
        }

        const newProps = {
          EnableIamAuth: true,
          DatabaseName: "testdb",
        }

        const sql = await engine.updateRole(
          "switchuser",
          "switchuser",
          newProps,
          oldProps
        )

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toContain("DROP USER IF EXISTS 'switchuser'@'%'")
        expect(sql[1]).toContain(
          "CREATE USER 'switchuser'@'%' IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'"
        )
        expect(sql[2]).toContain("GRANT ALL PRIVILEGES ON `testdb`.* TO 'switchuser'@'%'")
        expect(sql[3]).toBe("FLUSH PRIVILEGES")
      })

      it("should switch from IAM to password authentication", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("new-password")

        const oldProps = {
          EnableIamAuth: true,
        }

        const newProps = {
          EnableIamAuth: false,
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
          DatabaseName: "testdb",
        }

        const sql = await engine.updateRole(
          "switchuser",
          "switchuser",
          newProps,
          oldProps
        )

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toContain("DROP USER IF EXISTS 'switchuser'@'%'")
        expect(sql[1]).toContain(
          "CREATE USER 'switchuser'@'%' IDENTIFIED BY 'new-password'"
        )
        expect(sql[2]).toContain("GRANT ALL PRIVILEGES ON `testdb`.* TO 'switchuser'@'%'")
        expect(sql[3]).toBe("FLUSH PRIVILEGES")
      })
    })
  })

  describe("Schema", () => {
    it("should throw an error when trying to create a schema", () => {
      expect(() => engine.createSchema("testschema", {})).toThrow("not supported")
    })

    it("should throw an error when trying to update a schema", () => {
      expect(() => engine.updateSchema("newschema", "oldschema", {})).toThrow(
        "not supported"
      )
    })

    it("should throw an error when trying to delete a schema", () => {
      expect(() => engine.deleteSchema("testschema", {})).toThrow("not supported")
    })
  })

  describe("SQL", () => {
    it("should pass through SQL statements for create", () => {
      const statement = "SELECT * FROM users"
      const sql = engine.createSql("test", { Statement: statement })
      expect(sql).toBe(statement)
    })

    it("should pass through SQL statements for update", () => {
      const statement = "UPDATE users SET name = 'test'"
      const sql = engine.updateSql("test", "old", { Statement: statement })
      expect(sql).toBe(statement)
    })

    it("should pass through rollback SQL for delete", () => {
      const rollback = "DROP TABLE users"
      const sql = engine.deleteSql("test", { Rollback: rollback })
      expect(sql).toBe(rollback)
    })
  })
})
