import { AbstractEngine } from "./engine.abstract"
import { MysqlEngine } from "./engine.mysql"
import { PostgresqlEngine } from "./engine.postgresql"

export class EngineFactory {
  static createEngine(engine: string): AbstractEngine {
    switch (engine.toLowerCase()) {
      case "postgres":
      case "postgresql":
      case "aurora-postgresql":
        return new PostgresqlEngine()
      case "mysql":
      case "mariadb":
      case "aurora-mysql":
        return new MysqlEngine()
      default:
        throw new Error(`Unsupported database engine: ${engine}`)
    }
  }
}
