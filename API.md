# API Reference <a name="API Reference" id="api-reference"></a>

## Constructs <a name="Constructs" id="Constructs"></a>

### Database <a name="Database" id="cdk-rds-sql.Database"></a>

#### Initializers <a name="Initializers" id="cdk-rds-sql.Database.Initializer"></a>

```typescript
import { Database } from 'cdk-rds-sql'

new Database(scope: Construct, id: string, props: DatabaseProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Database.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Database.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Database.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-rds-sql.DatabaseProps">DatabaseProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-rds-sql.Database.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-rds-sql.Database.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-rds-sql.Database.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-rds-sql.DatabaseProps">DatabaseProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Database.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#cdk-rds-sql.Database.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#cdk-rds-sql.Database.getAtt">getAtt</a></code> | Returns the value of an attribute of the custom resource of an arbitrary type. |
| <code><a href="#cdk-rds-sql.Database.getAttString">getAttString</a></code> | Returns the value of an attribute of the custom resource of type string. |

---

##### `toString` <a name="toString" id="cdk-rds-sql.Database.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="cdk-rds-sql.Database.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="cdk-rds-sql.Database.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `getAtt` <a name="getAtt" id="cdk-rds-sql.Database.getAtt"></a>

```typescript
public getAtt(attributeName: string): Reference
```

Returns the value of an attribute of the custom resource of an arbitrary type.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Database.getAtt.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

##### `getAttString` <a name="getAttString" id="cdk-rds-sql.Database.getAttString"></a>

```typescript
public getAttString(attributeName: string): string
```

Returns the value of an attribute of the custom resource of type string.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Database.getAttString.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Database.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#cdk-rds-sql.Database.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#cdk-rds-sql.Database.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-rds-sql.Database.isConstruct"></a>

```typescript
import { Database } from 'cdk-rds-sql'

Database.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-rds-sql.Database.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="cdk-rds-sql.Database.isOwnedResource"></a>

```typescript
import { Database } from 'cdk-rds-sql'

Database.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Database.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="cdk-rds-sql.Database.isResource"></a>

```typescript
import { Database } from 'cdk-rds-sql'

Database.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Database.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Database.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-rds-sql.Database.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#cdk-rds-sql.Database.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#cdk-rds-sql.Database.property.ref">ref</a></code> | <code>string</code> | The physical name of this custom resource. |
| <code><a href="#cdk-rds-sql.Database.property.databaseName">databaseName</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-rds-sql.Database.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="cdk-rds-sql.Database.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="cdk-rds-sql.Database.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `ref`<sup>Required</sup> <a name="ref" id="cdk-rds-sql.Database.property.ref"></a>

```typescript
public readonly ref: string;
```

- *Type:* string

The physical name of this custom resource.

---

##### `databaseName`<sup>Required</sup> <a name="databaseName" id="cdk-rds-sql.Database.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string

---


### Provider <a name="Provider" id="cdk-rds-sql.Provider"></a>

#### Initializers <a name="Initializers" id="cdk-rds-sql.Provider.Initializer"></a>

```typescript
import { Provider } from 'cdk-rds-sql'

new Provider(scope: Construct, id: string, props: RdsSqlProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Provider.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Provider.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Provider.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-rds-sql.RdsSqlProps">RdsSqlProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-rds-sql.Provider.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-rds-sql.Provider.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-rds-sql.Provider.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-rds-sql.RdsSqlProps">RdsSqlProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Provider.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="cdk-rds-sql.Provider.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Provider.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-rds-sql.Provider.isConstruct"></a>

```typescript
import { Provider } from 'cdk-rds-sql'

Provider.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-rds-sql.Provider.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Provider.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-rds-sql.Provider.property.handler">handler</a></code> | <code>aws-cdk-lib.aws_lambda.IFunction</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Provider.property.secret">secret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Provider.property.serviceToken">serviceToken</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-rds-sql.Provider.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `handler`<sup>Required</sup> <a name="handler" id="cdk-rds-sql.Provider.property.handler"></a>

```typescript
public readonly handler: IFunction;
```

- *Type:* aws-cdk-lib.aws_lambda.IFunction

---

##### `secret`<sup>Required</sup> <a name="secret" id="cdk-rds-sql.Provider.property.secret"></a>

```typescript
public readonly secret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---

##### `serviceToken`<sup>Required</sup> <a name="serviceToken" id="cdk-rds-sql.Provider.property.serviceToken"></a>

```typescript
public readonly serviceToken: string;
```

- *Type:* string

---


### Role <a name="Role" id="cdk-rds-sql.Role"></a>

#### Initializers <a name="Initializers" id="cdk-rds-sql.Role.Initializer"></a>

```typescript
import { Role } from 'cdk-rds-sql'

new Role(scope: Construct, id: string, props: RoleProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Role.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Role.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Role.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-rds-sql.RoleProps">RoleProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-rds-sql.Role.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-rds-sql.Role.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-rds-sql.Role.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-rds-sql.RoleProps">RoleProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Role.toString">toString</a></code> | Returns a string representation of this construct. |

---

##### `toString` <a name="toString" id="cdk-rds-sql.Role.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Role.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-rds-sql.Role.isConstruct"></a>

```typescript
import { Role } from 'cdk-rds-sql'

Role.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-rds-sql.Role.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Role.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-rds-sql.Role.property.roleName">roleName</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-rds-sql.Role.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `roleName`<sup>Required</sup> <a name="roleName" id="cdk-rds-sql.Role.property.roleName"></a>

```typescript
public readonly roleName: string;
```

- *Type:* string

---


### Schema <a name="Schema" id="cdk-rds-sql.Schema"></a>

#### Initializers <a name="Initializers" id="cdk-rds-sql.Schema.Initializer"></a>

```typescript
import { Schema } from 'cdk-rds-sql'

new Schema(scope: Construct, id: string, props: SchemaProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Schema.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Schema.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Schema.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-rds-sql.SchemaProps">SchemaProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-rds-sql.Schema.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-rds-sql.Schema.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-rds-sql.Schema.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-rds-sql.SchemaProps">SchemaProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Schema.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#cdk-rds-sql.Schema.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#cdk-rds-sql.Schema.getAtt">getAtt</a></code> | Returns the value of an attribute of the custom resource of an arbitrary type. |
| <code><a href="#cdk-rds-sql.Schema.getAttString">getAttString</a></code> | Returns the value of an attribute of the custom resource of type string. |

---

##### `toString` <a name="toString" id="cdk-rds-sql.Schema.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="cdk-rds-sql.Schema.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="cdk-rds-sql.Schema.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `getAtt` <a name="getAtt" id="cdk-rds-sql.Schema.getAtt"></a>

```typescript
public getAtt(attributeName: string): Reference
```

Returns the value of an attribute of the custom resource of an arbitrary type.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Schema.getAtt.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

##### `getAttString` <a name="getAttString" id="cdk-rds-sql.Schema.getAttString"></a>

```typescript
public getAttString(attributeName: string): string
```

Returns the value of an attribute of the custom resource of type string.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Schema.getAttString.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Schema.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#cdk-rds-sql.Schema.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#cdk-rds-sql.Schema.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-rds-sql.Schema.isConstruct"></a>

```typescript
import { Schema } from 'cdk-rds-sql'

Schema.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-rds-sql.Schema.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="cdk-rds-sql.Schema.isOwnedResource"></a>

```typescript
import { Schema } from 'cdk-rds-sql'

Schema.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Schema.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="cdk-rds-sql.Schema.isResource"></a>

```typescript
import { Schema } from 'cdk-rds-sql'

Schema.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Schema.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Schema.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-rds-sql.Schema.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#cdk-rds-sql.Schema.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#cdk-rds-sql.Schema.property.ref">ref</a></code> | <code>string</code> | The physical name of this custom resource. |
| <code><a href="#cdk-rds-sql.Schema.property.schemaName">schemaName</a></code> | <code>string</code> | *No description.* |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-rds-sql.Schema.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="cdk-rds-sql.Schema.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="cdk-rds-sql.Schema.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `ref`<sup>Required</sup> <a name="ref" id="cdk-rds-sql.Schema.property.ref"></a>

```typescript
public readonly ref: string;
```

- *Type:* string

The physical name of this custom resource.

---

##### `schemaName`<sup>Required</sup> <a name="schemaName" id="cdk-rds-sql.Schema.property.schemaName"></a>

```typescript
public readonly schemaName: string;
```

- *Type:* string

---


### Sql <a name="Sql" id="cdk-rds-sql.Sql"></a>

#### Initializers <a name="Initializers" id="cdk-rds-sql.Sql.Initializer"></a>

```typescript
import { Sql } from 'cdk-rds-sql'

new Sql(scope: Construct, id: string, props: SqlProps)
```

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Sql.Initializer.parameter.scope">scope</a></code> | <code>constructs.Construct</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Sql.Initializer.parameter.id">id</a></code> | <code>string</code> | *No description.* |
| <code><a href="#cdk-rds-sql.Sql.Initializer.parameter.props">props</a></code> | <code><a href="#cdk-rds-sql.SqlProps">SqlProps</a></code> | *No description.* |

---

##### `scope`<sup>Required</sup> <a name="scope" id="cdk-rds-sql.Sql.Initializer.parameter.scope"></a>

- *Type:* constructs.Construct

---

##### `id`<sup>Required</sup> <a name="id" id="cdk-rds-sql.Sql.Initializer.parameter.id"></a>

- *Type:* string

---

##### `props`<sup>Required</sup> <a name="props" id="cdk-rds-sql.Sql.Initializer.parameter.props"></a>

- *Type:* <a href="#cdk-rds-sql.SqlProps">SqlProps</a>

---

#### Methods <a name="Methods" id="Methods"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Sql.toString">toString</a></code> | Returns a string representation of this construct. |
| <code><a href="#cdk-rds-sql.Sql.applyRemovalPolicy">applyRemovalPolicy</a></code> | Apply the given removal policy to this resource. |
| <code><a href="#cdk-rds-sql.Sql.getAtt">getAtt</a></code> | Returns the value of an attribute of the custom resource of an arbitrary type. |
| <code><a href="#cdk-rds-sql.Sql.getAttString">getAttString</a></code> | Returns the value of an attribute of the custom resource of type string. |

---

##### `toString` <a name="toString" id="cdk-rds-sql.Sql.toString"></a>

```typescript
public toString(): string
```

Returns a string representation of this construct.

##### `applyRemovalPolicy` <a name="applyRemovalPolicy" id="cdk-rds-sql.Sql.applyRemovalPolicy"></a>

```typescript
public applyRemovalPolicy(policy: RemovalPolicy): void
```

Apply the given removal policy to this resource.

The Removal Policy controls what happens to this resource when it stops
being managed by CloudFormation, either because you've removed it from the
CDK application or because you've made a change that requires the resource
to be replaced.

The resource can be deleted (`RemovalPolicy.DESTROY`), or left in your AWS
account for data recovery and cleanup later (`RemovalPolicy.RETAIN`).

###### `policy`<sup>Required</sup> <a name="policy" id="cdk-rds-sql.Sql.applyRemovalPolicy.parameter.policy"></a>

- *Type:* aws-cdk-lib.RemovalPolicy

---

##### `getAtt` <a name="getAtt" id="cdk-rds-sql.Sql.getAtt"></a>

```typescript
public getAtt(attributeName: string): Reference
```

Returns the value of an attribute of the custom resource of an arbitrary type.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Sql.getAtt.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

##### `getAttString` <a name="getAttString" id="cdk-rds-sql.Sql.getAttString"></a>

```typescript
public getAttString(attributeName: string): string
```

Returns the value of an attribute of the custom resource of type string.

Attributes are returned from the custom resource provider through the
`Data` map where the key is the attribute name.

###### `attributeName`<sup>Required</sup> <a name="attributeName" id="cdk-rds-sql.Sql.getAttString.parameter.attributeName"></a>

- *Type:* string

the name of the attribute.

---

#### Static Functions <a name="Static Functions" id="Static Functions"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.Sql.isConstruct">isConstruct</a></code> | Checks if `x` is a construct. |
| <code><a href="#cdk-rds-sql.Sql.isOwnedResource">isOwnedResource</a></code> | Returns true if the construct was created by CDK, and false otherwise. |
| <code><a href="#cdk-rds-sql.Sql.isResource">isResource</a></code> | Check whether the given construct is a Resource. |

---

##### `isConstruct` <a name="isConstruct" id="cdk-rds-sql.Sql.isConstruct"></a>

```typescript
import { Sql } from 'cdk-rds-sql'

Sql.isConstruct(x: any)
```

Checks if `x` is a construct.

Use this method instead of `instanceof` to properly detect `Construct`
instances, even when the construct library is symlinked.

Explanation: in JavaScript, multiple copies of the `constructs` library on
disk are seen as independent, completely different libraries. As a
consequence, the class `Construct` in each copy of the `constructs` library
is seen as a different class, and an instance of one class will not test as
`instanceof` the other class. `npm install` will not create installations
like this, but users may manually symlink construct libraries together or
use a monorepo tool: in those cases, multiple copies of the `constructs`
library can be accidentally installed, and `instanceof` will behave
unpredictably. It is safest to avoid using `instanceof`, and using
this type-testing method instead.

###### `x`<sup>Required</sup> <a name="x" id="cdk-rds-sql.Sql.isConstruct.parameter.x"></a>

- *Type:* any

Any object.

---

##### `isOwnedResource` <a name="isOwnedResource" id="cdk-rds-sql.Sql.isOwnedResource"></a>

```typescript
import { Sql } from 'cdk-rds-sql'

Sql.isOwnedResource(construct: IConstruct)
```

Returns true if the construct was created by CDK, and false otherwise.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Sql.isOwnedResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

##### `isResource` <a name="isResource" id="cdk-rds-sql.Sql.isResource"></a>

```typescript
import { Sql } from 'cdk-rds-sql'

Sql.isResource(construct: IConstruct)
```

Check whether the given construct is a Resource.

###### `construct`<sup>Required</sup> <a name="construct" id="cdk-rds-sql.Sql.isResource.parameter.construct"></a>

- *Type:* constructs.IConstruct

---

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.Sql.property.node">node</a></code> | <code>constructs.Node</code> | The tree node. |
| <code><a href="#cdk-rds-sql.Sql.property.env">env</a></code> | <code>aws-cdk-lib.ResourceEnvironment</code> | The environment this resource belongs to. |
| <code><a href="#cdk-rds-sql.Sql.property.stack">stack</a></code> | <code>aws-cdk-lib.Stack</code> | The stack in which this resource is defined. |
| <code><a href="#cdk-rds-sql.Sql.property.ref">ref</a></code> | <code>string</code> | The physical name of this custom resource. |

---

##### `node`<sup>Required</sup> <a name="node" id="cdk-rds-sql.Sql.property.node"></a>

```typescript
public readonly node: Node;
```

- *Type:* constructs.Node

The tree node.

---

##### `env`<sup>Required</sup> <a name="env" id="cdk-rds-sql.Sql.property.env"></a>

```typescript
public readonly env: ResourceEnvironment;
```

- *Type:* aws-cdk-lib.ResourceEnvironment

The environment this resource belongs to.

For resources that are created and managed by the CDK
(generally, those created by creating new class instances like Role, Bucket, etc.),
this is always the same as the environment of the stack they belong to;
however, for imported resources
(those obtained from static methods like fromRoleArn, fromBucketName, etc.),
that might be different than the stack they were imported into.

---

##### `stack`<sup>Required</sup> <a name="stack" id="cdk-rds-sql.Sql.property.stack"></a>

```typescript
public readonly stack: Stack;
```

- *Type:* aws-cdk-lib.Stack

The stack in which this resource is defined.

---

##### `ref`<sup>Required</sup> <a name="ref" id="cdk-rds-sql.Sql.property.ref"></a>

```typescript
public readonly ref: string;
```

- *Type:* string

The physical name of this custom resource.

---


## Structs <a name="Structs" id="Structs"></a>

### DatabaseProps <a name="DatabaseProps" id="cdk-rds-sql.DatabaseProps"></a>

#### Initializer <a name="Initializer" id="cdk-rds-sql.DatabaseProps.Initializer"></a>

```typescript
import { DatabaseProps } from 'cdk-rds-sql'

const databaseProps: DatabaseProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.DatabaseProps.property.databaseName">databaseName</a></code> | <code>string</code> | Name of database to create. |
| <code><a href="#cdk-rds-sql.DatabaseProps.property.provider">provider</a></code> | <code><a href="#cdk-rds-sql.Provider">Provider</a></code> | Provider. |
| <code><a href="#cdk-rds-sql.DatabaseProps.property.owner">owner</a></code> | <code><a href="#cdk-rds-sql.Role">Role</a></code> | Optional database owner. |

---

##### `databaseName`<sup>Required</sup> <a name="databaseName" id="cdk-rds-sql.DatabaseProps.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string

Name of database to create.

---

##### `provider`<sup>Required</sup> <a name="provider" id="cdk-rds-sql.DatabaseProps.property.provider"></a>

```typescript
public readonly provider: Provider;
```

- *Type:* <a href="#cdk-rds-sql.Provider">Provider</a>

Provider.

---

##### `owner`<sup>Optional</sup> <a name="owner" id="cdk-rds-sql.DatabaseProps.property.owner"></a>

```typescript
public readonly owner: Role;
```

- *Type:* <a href="#cdk-rds-sql.Role">Role</a>

Optional database owner.

---

### RdsSqlProps <a name="RdsSqlProps" id="cdk-rds-sql.RdsSqlProps"></a>

#### Initializer <a name="Initializer" id="cdk-rds-sql.RdsSqlProps.Initializer"></a>

```typescript
import { RdsSqlProps } from 'cdk-rds-sql'

const rdsSqlProps: RdsSqlProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.RdsSqlProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.IServerlessCluster</code> | *No description.* |
| <code><a href="#cdk-rds-sql.RdsSqlProps.property.secret">secret</a></code> | <code>aws-cdk-lib.aws_secretsmanager.ISecret</code> | *No description.* |
| <code><a href="#cdk-rds-sql.RdsSqlProps.property.vpc">vpc</a></code> | <code>aws-cdk-lib.aws_ec2.IVpc</code> | *No description.* |

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="cdk-rds-sql.RdsSqlProps.property.cluster"></a>

```typescript
public readonly cluster: IServerlessCluster;
```

- *Type:* aws-cdk-lib.aws_rds.IServerlessCluster

---

##### `secret`<sup>Required</sup> <a name="secret" id="cdk-rds-sql.RdsSqlProps.property.secret"></a>

```typescript
public readonly secret: ISecret;
```

- *Type:* aws-cdk-lib.aws_secretsmanager.ISecret

---

##### `vpc`<sup>Required</sup> <a name="vpc" id="cdk-rds-sql.RdsSqlProps.property.vpc"></a>

```typescript
public readonly vpc: IVpc;
```

- *Type:* aws-cdk-lib.aws_ec2.IVpc

---

### RoleProps <a name="RoleProps" id="cdk-rds-sql.RoleProps"></a>

#### Initializer <a name="Initializer" id="cdk-rds-sql.RoleProps.Initializer"></a>

```typescript
import { RoleProps } from 'cdk-rds-sql'

const roleProps: RoleProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.RoleProps.property.cluster">cluster</a></code> | <code>aws-cdk-lib.aws_rds.ServerlessCluster</code> | Database cluster to access. |
| <code><a href="#cdk-rds-sql.RoleProps.property.databaseName">databaseName</a></code> | <code>string</code> | Database name this user is expected to use. |
| <code><a href="#cdk-rds-sql.RoleProps.property.provider">provider</a></code> | <code><a href="#cdk-rds-sql.Provider">Provider</a></code> | Provider. |
| <code><a href="#cdk-rds-sql.RoleProps.property.roleName">roleName</a></code> | <code>string</code> | SQL. |
| <code><a href="#cdk-rds-sql.RoleProps.property.encryptionKey">encryptionKey</a></code> | <code>aws-cdk-lib.aws_kms.IKey</code> | A new secret is created for this user. |

---

##### `cluster`<sup>Required</sup> <a name="cluster" id="cdk-rds-sql.RoleProps.property.cluster"></a>

```typescript
public readonly cluster: ServerlessCluster;
```

- *Type:* aws-cdk-lib.aws_rds.ServerlessCluster

Database cluster to access.

---

##### `databaseName`<sup>Required</sup> <a name="databaseName" id="cdk-rds-sql.RoleProps.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string

Database name this user is expected to use.

---

##### `provider`<sup>Required</sup> <a name="provider" id="cdk-rds-sql.RoleProps.property.provider"></a>

```typescript
public readonly provider: Provider;
```

- *Type:* <a href="#cdk-rds-sql.Provider">Provider</a>

Provider.

---

##### `roleName`<sup>Required</sup> <a name="roleName" id="cdk-rds-sql.RoleProps.property.roleName"></a>

```typescript
public readonly roleName: string;
```

- *Type:* string

SQL.

---

##### `encryptionKey`<sup>Optional</sup> <a name="encryptionKey" id="cdk-rds-sql.RoleProps.property.encryptionKey"></a>

```typescript
public readonly encryptionKey: IKey;
```

- *Type:* aws-cdk-lib.aws_kms.IKey

A new secret is created for this user.

Optionally encrypt it with the given key.

---

### SchemaProps <a name="SchemaProps" id="cdk-rds-sql.SchemaProps"></a>

#### Initializer <a name="Initializer" id="cdk-rds-sql.SchemaProps.Initializer"></a>

```typescript
import { SchemaProps } from 'cdk-rds-sql'

const schemaProps: SchemaProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.SchemaProps.property.provider">provider</a></code> | <code><a href="#cdk-rds-sql.Provider">Provider</a></code> | Provider. |
| <code><a href="#cdk-rds-sql.SchemaProps.property.schemaName">schemaName</a></code> | <code>string</code> | SQL. |
| <code><a href="#cdk-rds-sql.SchemaProps.property.databaseName">databaseName</a></code> | <code>string</code> | Optional database. |

---

##### `provider`<sup>Required</sup> <a name="provider" id="cdk-rds-sql.SchemaProps.property.provider"></a>

```typescript
public readonly provider: Provider;
```

- *Type:* <a href="#cdk-rds-sql.Provider">Provider</a>

Provider.

---

##### `schemaName`<sup>Required</sup> <a name="schemaName" id="cdk-rds-sql.SchemaProps.property.schemaName"></a>

```typescript
public readonly schemaName: string;
```

- *Type:* string

SQL.

---

##### `databaseName`<sup>Optional</sup> <a name="databaseName" id="cdk-rds-sql.SchemaProps.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string
- *Default:* use default database

Optional database.

---

### SqlProps <a name="SqlProps" id="cdk-rds-sql.SqlProps"></a>

#### Initializer <a name="Initializer" id="cdk-rds-sql.SqlProps.Initializer"></a>

```typescript
import { SqlProps } from 'cdk-rds-sql'

const sqlProps: SqlProps = { ... }
```

#### Properties <a name="Properties" id="Properties"></a>

| **Name** | **Type** | **Description** |
| --- | --- | --- |
| <code><a href="#cdk-rds-sql.SqlProps.property.provider">provider</a></code> | <code><a href="#cdk-rds-sql.Provider">Provider</a></code> | Provider. |
| <code><a href="#cdk-rds-sql.SqlProps.property.databaseName">databaseName</a></code> | <code>string</code> | Optional database. |
| <code><a href="#cdk-rds-sql.SqlProps.property.statement">statement</a></code> | <code>string</code> | SQL. |

---

##### `provider`<sup>Required</sup> <a name="provider" id="cdk-rds-sql.SqlProps.property.provider"></a>

```typescript
public readonly provider: Provider;
```

- *Type:* <a href="#cdk-rds-sql.Provider">Provider</a>

Provider.

---

##### `databaseName`<sup>Optional</sup> <a name="databaseName" id="cdk-rds-sql.SqlProps.property.databaseName"></a>

```typescript
public readonly databaseName: string;
```

- *Type:* string
- *Default:* use default database

Optional database.

---

##### `statement`<sup>Optional</sup> <a name="statement" id="cdk-rds-sql.SqlProps.property.statement"></a>

```typescript
public readonly statement: string;
```

- *Type:* string

SQL.

---



## Enums <a name="Enums" id="Enums"></a>

### RdsSqlResource <a name="RdsSqlResource" id="cdk-rds-sql.RdsSqlResource"></a>

#### Members <a name="Members" id="Members"></a>

| **Name** | **Description** |
| --- | --- |
| <code><a href="#cdk-rds-sql.RdsSqlResource.SCHEMA">SCHEMA</a></code> | *No description.* |
| <code><a href="#cdk-rds-sql.RdsSqlResource.ROLE">ROLE</a></code> | *No description.* |
| <code><a href="#cdk-rds-sql.RdsSqlResource.SQL">SQL</a></code> | *No description.* |
| <code><a href="#cdk-rds-sql.RdsSqlResource.DATABASE">DATABASE</a></code> | *No description.* |

---

##### `SCHEMA` <a name="SCHEMA" id="cdk-rds-sql.RdsSqlResource.SCHEMA"></a>

---


##### `ROLE` <a name="ROLE" id="cdk-rds-sql.RdsSqlResource.ROLE"></a>

---


##### `SQL` <a name="SQL" id="cdk-rds-sql.RdsSqlResource.SQL"></a>

---


##### `DATABASE` <a name="DATABASE" id="cdk-rds-sql.RdsSqlResource.DATABASE"></a>

---

