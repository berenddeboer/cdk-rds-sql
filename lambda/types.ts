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

export interface EngineIamGrantProperties {
  readonly RoleName: string
  readonly ResourceArn: string
}

// Common CloudFormation properties shared by all resources
export interface CommonProperties
  extends CloudFormationCustomResourceResourcePropertiesCommon {
  readonly Resource: RdsSqlResource
  readonly ResourceId?: string // set if we know the exact physical resource id to return; not passed by sql or iam grant
  readonly SecretArn?: string // SecretArn is not set for DSQL
}

// CloudFormation-specific properties (engine properties + CloudFormation metadata)
export interface DatabaseProperties extends CommonProperties, EngineDatabaseProperties {
  readonly Resource: RdsSqlResource.DATABASE
}

export interface RoleProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.ROLE
  readonly PasswordArn?: string
  readonly DatabaseName?: string
  readonly EnableIamAuth?: string // CloudFormation passes boolean as string
}

export interface SchemaProperties extends CommonProperties, EngineSchemaProperties {
  readonly Resource: RdsSqlResource.SCHEMA
}

export interface SqlProperties extends CommonProperties, EngineSqlProperties {
  readonly Resource: RdsSqlResource.SQL
}

export interface IamGrantProperties extends CommonProperties, EngineIamGrantProperties {
  readonly Resource: RdsSqlResource.IAM_GRANT
  readonly ResourceArn: string
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
  | IamGrantProperties
  | ParameterPasswordProperties

// Custom resource response interface
export interface CustomResourceResponse {
  PhysicalResourceId?: string
  Data?: any
  NoEcho?: boolean
}
