import { CloudFormationCustomResourceResourcePropertiesCommon } from "aws-lambda"
import { RdsSqlResource } from "../src/enum"

// Common properties shared by all resources
export interface CommonProperties
  extends CloudFormationCustomResourceResourcePropertiesCommon {
  readonly Resource: RdsSqlResource
  readonly ResourceId: string
  readonly SecretArn: string
}

// Database specific properties
export interface DatabaseProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.DATABASE
  readonly Owner?: string
}

// Role specific properties
export interface RoleProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.ROLE
  readonly PasswordArn?: string
  readonly DatabaseName?: string
}

// Schema specific properties
export interface SchemaProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.SCHEMA
  readonly DatabaseName?: string
  readonly RoleName?: string
}

// SQL specific properties
export interface SqlProperties extends CommonProperties {
  readonly Resource: RdsSqlResource.SQL
  readonly DatabaseName?: string
  readonly Statement?: string
  readonly Rollback?: string
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
