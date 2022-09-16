import { awscdk } from 'projen';
const project = new awscdk.AwsCdkConstructLibrary({
  projenrcTs: true,
  author: 'Berend de Boer',
  authorAddress: 'berend@pobox.com',
  authorEmail: 'berend@pobox.com',
  cdkVersion: '2.41.0',
  constructsVersion: '10.1.101',
  defaultReleaseBranch: 'main',
  name: 'ts-test',
  repositoryUrl: 'https://github.com/berenddeboer/cdk-rds-sql.git',
  deps: [],
  // description: undefined,  /* The description is just a string that helps people understand the purpose of the package. */
  devDeps: [],
  // packageName: undefined,  /* The "name" in package.json. */
});
project.addGitIgnore('*~');
project.synth();
