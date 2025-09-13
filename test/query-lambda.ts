import { DsqlSigner } from "@aws-sdk/dsql-signer"
import { Client } from "pg"

export const handler = async (): Promise<any> => {
  const host = process.env.PGHOST
  const dbName = process.env.PGDATABASE
  const dbUser = process.env.PGUSER

  if (!host) throw new Error("PGHOST must be set")
  if (!dbName) throw new Error("PGDATABASE must be set")
  if (!dbUser) throw new Error("PGUSER must be set")

  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-west-2"

  // Generate DSQL auth token using AWS SDK
  const signer = new DsqlSigner({
    hostname: host,
    region,
  })

  const authToken = await signer.getDbConnectAuthToken()

  const client = new Client({
    host,
    port: 5432,
    user: dbUser,
    database: dbName,
    password: authToken,
    ssl: { rejectUnauthorized: false },
  })

  await client.connect()

  const result = await client.query("SELECT COUNT(*) FROM myschema.test_table")
  const count = result.rows[0].count

  await client.end()

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Found ${count} rows in myschema.test_table`,
      count: count,
    }),
  }
}
