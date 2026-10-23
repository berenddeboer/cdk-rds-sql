import { MysqlEngine } from "./engine.mysql"
import { quoteMysqlIdentifier, quoteMysqlString } from "./mysql-quote"

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
      await expect(engine.createRole("testrole", {})).rejects.toThrow("No PasswordArn provided")
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

    it("should generate correct SQL for deleting a role", async () => {
      const sql = await engine.deleteRole("testrole", { DatabaseName: "testdb" })
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
        (statement) => statement.includes("REVOKE ALL PRIVILEGES") && statement.includes("`olddb`")
      )
      expect(revokeStatement).toBeDefined()

      // Check for grant statement for the new database
      const grantStatement = sql.find(
        (statement) => statement.includes("GRANT ALL PRIVILEGES") && statement.includes("`newdb`")
      )
      expect(grantStatement).toBeDefined()
    })

    describe("max user connections", () => {
      it("should apply the connection limit when creating a password user", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const sql = await engine.createRole("siteuser", {
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
          MaxUserConnections: 5,
        })

        expect(sql).toContain(
          "CREATE USER IF NOT EXISTS 'siteuser'@'%' IDENTIFIED BY 'test-password'"
        )
        expect(sql).toContain("ALTER USER 'siteuser'@'%' WITH MAX_USER_CONNECTIONS 5")
        expect(sql.findIndex((statement) => statement.includes("CREATE USER"))).toBeLessThan(
          sql.findIndex((statement) => statement.includes("MAX_USER_CONNECTIONS"))
        )
        expect(sql[sql.length - 1]).toBe("FLUSH PRIVILEGES")
      })

      it("should apply the connection limit when creating an IAM user", async () => {
        const sql = await engine.createRole("iamuser", {
          EnableIamAuth: true,
          MaxUserConnections: 5,
        })

        expect(sql).toContain(
          "CREATE USER IF NOT EXISTS 'iamuser'@'%' IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'"
        )
        expect(sql).toContain("ALTER USER 'iamuser'@'%' WITH MAX_USER_CONNECTIONS 5")
      })

      it("should not add a connection limit when the prop is unset", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const sql = await engine.createRole("siteuser", {
          PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
        })

        expect(sql.some((statement) => statement.includes("MAX_USER_CONNECTIONS"))).toBe(false)
      })

      it("should apply a reduced connection limit on update", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const sql = await engine.updateRole(
          "siteuser",
          "siteuser",
          {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
            MaxUserConnections: 3,
          },
          {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
            MaxUserConnections: 10,
          }
        )

        expect(sql).toContain("ALTER USER 'siteuser'@'%' WITH MAX_USER_CONNECTIONS 3")
        expect(sql.some((statement) => statement.includes("MAX_USER_CONNECTIONS 10"))).toBe(false)
      })

      it("should reapply the connection limit after a rename recreates the user", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const sql = await engine.updateRole(
          "newuser",
          "olduser",
          {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
            MaxUserConnections: 5,
          },
          {
            MaxUserConnections: 5,
          }
        )

        const createAt = sql.findIndex((statement) => statement.includes("CREATE USER"))
        const alterAt = sql.findIndex((statement) => statement.includes("MAX_USER_CONNECTIONS"))
        expect(alterAt).toBeGreaterThan(createAt)
        expect(sql[alterAt]).toBe("ALTER USER 'newuser'@'%' WITH MAX_USER_CONNECTIONS 5")
      })

      it("should not add a connection limit when updating a role without the prop", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        const sql = await engine.updateRole(
          "siteuser",
          "siteuser",
          {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
          },
          {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
            MaxUserConnections: 5,
          }
        )

        expect(sql.some((statement) => statement.includes("MAX_USER_CONNECTIONS"))).toBe(false)
      })

      it("should reject a negative connection limit", async () => {
        jest.spyOn(engine as any, "getPassword").mockResolvedValue("test-password")

        await expect(
          engine.createRole("siteuser", {
            PasswordArn: "arn:aws:secretsmanager:region:account:secret:name",
            MaxUserConnections: -1,
          })
        ).rejects.toThrow("non-negative integer")
      })
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
        expect(sql[1]).toContain("GRANT ALL PRIVILEGES ON `testdb`.* TO 'passworduser'@'%'")
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

        const sql = await engine.updateRole("switchuser", "switchuser", newProps, oldProps)

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

        const sql = await engine.updateRole("switchuser", "switchuser", newProps, oldProps)

        expect(Array.isArray(sql)).toBe(true)
        expect(sql[0]).toContain("DROP USER IF EXISTS 'switchuser'@'%'")
        expect(sql[1]).toContain("CREATE USER 'switchuser'@'%' IDENTIFIED BY 'new-password'")
        expect(sql[2]).toContain("GRANT ALL PRIVILEGES ON `testdb`.* TO 'switchuser'@'%'")
        expect(sql[3]).toBe("FLUSH PRIVILEGES")
      })
    })
  })

  describe("escaping", () => {
    const passwordArn = "arn:aws:secretsmanager:region:account:secret:name"
    const password = "it's-a\\password"
    const user = "o'brien"
    const database = "db`tick"

    beforeEach(() => {
      jest.spyOn(engine as any, "getPassword").mockResolvedValue(password)
    })

    it("quotes identifiers by doubling backticks and does not depend on SQL mode", () => {
      expect(quoteMysqlIdentifier(database)).toBe("`db``tick`")
      expect(quoteMysqlIdentifier("o'brien")).toBe("`o'brien`")
      expect(quoteMysqlIdentifier("a\\b")).toBe("`a\\b`")
    })

    it("doubles apostrophes and escapes backslashes in the default SQL mode", () => {
      expect(quoteMysqlString(password, "")).toBe("'it''s-a\\\\password'")
      expect(quoteMysqlString(password, "ANSI_QUOTES")).toBe("'it''s-a\\\\password'")
      expect(quoteMysqlString("line\n\t\0", "")).toBe("'line\\n\\t\\0'")
    })

    it("does not escape backslashes when NO_BACKSLASH_ESCAPES is set", () => {
      const mode = "ONLY_FULL_GROUP_BY, NO_BACKSLASH_ESCAPES,ANSI_QUOTES"
      expect(quoteMysqlString(password, mode)).toBe("'it''s-a\\password'")
      expect(quoteMysqlString("line\n", mode)).toBe("'line\n'")
    })

    it("escapes database names and owners", () => {
      expect(engine.createDatabase(database, { Owner: user })).toEqual([
        "CREATE DATABASE IF NOT EXISTS `db``tick`",
        "GRANT ALL PRIVILEGES ON `db``tick`.* TO 'o''brien'@'%'",
        "FLUSH PRIVILEGES",
      ])
      expect(engine.deleteDatabase(database, "master")).toEqual([
        "DROP DATABASE IF EXISTS `db``tick`",
      ])
    })

    it("escapes a password and delimited names when creating a role", async () => {
      const sql = await engine.createRole(user, {
        PasswordArn: passwordArn,
        DatabaseName: database,
        MaxUserConnections: 5,
      })

      expect(sql).toEqual([
        "CREATE USER IF NOT EXISTS 'o''brien'@'%' IDENTIFIED BY 'it''s-a\\\\password'",
        "GRANT ALL PRIVILEGES ON `db``tick`.* TO 'o''brien'@'%'",
        "ALTER USER 'o''brien'@'%' WITH MAX_USER_CONNECTIONS 5",
        "FLUSH PRIVILEGES",
      ])
    })

    it("quotes a backslash password for NO_BACKSLASH_ESCAPES", async () => {
      engine.setSqlMode("STRICT_TRANS_TABLES,NO_BACKSLASH_ESCAPES")

      const sql = await engine.createRole("a\\b", {
        PasswordArn: passwordArn,
      })

      expect(sql[0]).toBe("CREATE USER IF NOT EXISTS 'a\\b'@'%' IDENTIFIED BY 'it''s-a\\password'")
    })

    it("escapes the user name of an IAM role", async () => {
      const sql = await engine.createRole(user, { EnableIamAuth: true })

      expect(sql[0]).toBe(
        "CREATE USER IF NOT EXISTS 'o''brien'@'%' IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'"
      )
    })

    it("escapes a password change", async () => {
      const sql = await engine.updateRole(
        user,
        user,
        { PasswordArn: passwordArn, DatabaseName: database },
        { PasswordArn: passwordArn, DatabaseName: "old`db" }
      )

      expect(sql).toContain("ALTER USER 'o''brien'@'%' IDENTIFIED BY 'it''s-a\\\\password'")
      expect(sql).toContain("REVOKE ALL PRIVILEGES ON `old``db`.* FROM 'o''brien'@'%'")
      expect(sql).toContain("GRANT ALL PRIVILEGES ON `db``tick`.* TO 'o''brien'@'%'")
    })

    it("escapes both names when renaming a password user", async () => {
      const sql = await engine.updateRole(user, "old'user", { PasswordArn: passwordArn }, {})

      expect(sql[0]).toBe(
        "CREATE USER IF NOT EXISTS 'o''brien'@'%' IDENTIFIED BY 'it''s-a\\\\password'"
      )
      expect(sql[1]).toBe("DROP USER IF EXISTS 'old''user'@'%'")
    })

    it("escapes a rename that expires a generated password", async () => {
      const sql = await engine.updateRole(user, "old'user", {}, {})

      expect(sql[0]).toBe("CREATE USER IF NOT EXISTS 'o''brien'@'%' IDENTIFIED BY UUID()")
      expect(sql[1]).toBe("ALTER USER 'o''brien'@'%' PASSWORD EXPIRE")
      expect(sql[2]).toBe("DROP USER IF EXISTS 'old''user'@'%'")
    })

    it("escapes a switch from IAM to password authentication", async () => {
      const sql = await engine.updateRole(
        user,
        user,
        { EnableIamAuth: false, PasswordArn: passwordArn },
        { EnableIamAuth: true }
      )

      expect(sql[0]).toBe("DROP USER IF EXISTS 'o''brien'@'%'")
      expect(sql[1]).toBe("CREATE USER 'o''brien'@'%' IDENTIFIED BY 'it''s-a\\\\password'")
    })

    it("escapes a switch from password to IAM authentication", async () => {
      const sql = await engine.updateRole(
        user,
        user,
        { EnableIamAuth: true },
        { EnableIamAuth: false }
      )

      expect(sql[0]).toBe("DROP USER IF EXISTS 'o''brien'@'%'")
      expect(sql[1]).toBe(
        "CREATE USER 'o''brien'@'%' IDENTIFIED WITH AWSAuthenticationPlugin as 'RDS'"
      )
    })

    it("escapes a role delete", async () => {
      const sql = await engine.deleteRole(user, { DatabaseName: database })

      expect(sql).toEqual([
        "REVOKE ALL PRIVILEGES ON `db``tick`.* FROM 'o''brien'@'%'",
        "DROP USER IF EXISTS 'o''brien'@'%'",
        "FLUSH PRIVILEGES",
      ])
    })
  })

  describe("Schema", () => {
    it("should throw an error when trying to create a schema", () => {
      expect(() => engine.createSchema("testschema", {})).toThrow("not supported")
    })

    it("should throw an error when trying to update a schema", () => {
      expect(() => engine.updateSchema("newschema", "oldschema", {})).toThrow("not supported")
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
