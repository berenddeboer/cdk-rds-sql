import { CloudFormationCustomResourceResourcePropertiesCommon } from "aws-lambda"
import { RdsSqlResource } from "../src/enum"

// Engine-specific interfaces (business logic properties only)
export interface EngineDatabaseProperties {
  readonly Owner?: string
  readonly MasterOwner?: string
}

export interface EngineRoleProperties {
  readonly PasswordArn?: string
  readonly DatabaseName?: string
  readonly EnableIamAuth?: boolean
}

export interface EngineSchemaProperties {
  readonly DatabaseName?: string
  readonly RoleName?: string
}

export interface EngineSqlProperties {
  readonly DatabaseName?: string
  readonly Statement?: string
  readonly Rollback?: string
}

// Common CloudFormation properties shared by all resources
export interface CommonProperties
  extends CloudFormationCustomResourceResourcePropertiesCommon {
  readonly Resource: RdsSqlResource
  readonly ResourceId: string
  readonly SecretArn: string
}

// CloudFormation-specific properties (engine properties + CloudFormation metadata)
export interface DatabaseProperties extends CommonProperties, EngineDatabaseProperties {
  readonly Resource: RdsSqlResource.DATABASE
}

export interface RoleProperties extends CommonProperties, EngineRoleProperties {
  readonly Resource: RdsSqlResource.ROLE
}

export interface SchemaProperties extends CommonProperties, EngineSchemaProperties {
  readonly Resource: RdsSqlResource.SCHEMA
}

export interface SqlProperties extends CommonProperties, EngineSqlProperties {
  readonly Resource: RdsSqlResource.SQL
}

// Parameter password specific properties
export interface ParameterPasswordProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.PARAMETER_PASSWORD
  readonly PasswordArn: string
  readonly ParameterName: string
}

// Union type of all resource properties
export type ResourceProperties =
  | DatabaseProperties
  | RoleProperties
  | SchemaProperties
  | SqlProperties
  | ParameterPasswordProperties

// Custom resource response interface
export interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}
