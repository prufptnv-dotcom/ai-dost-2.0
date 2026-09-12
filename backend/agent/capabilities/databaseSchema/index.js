/**
 * Database Schema Generation & Migration Capability
 * Capability #9: coding.database_schema_generation
 */

const DatabaseSchemaPlanModule = require('./DatabaseSchemaPlan');
const DatabaseSchemaValidatorModule = require('./DatabaseSchemaValidator');
const DatabaseSchemaGeneratorModule = require('./DatabaseSchemaGenerator');
const DatabaseMigrationManagerModule = require('./DatabaseMigrationManager');
const DatabaseSchemaResultModule = require('./DatabaseSchemaResult');

const DatabaseSchemaPlan = DatabaseSchemaPlanModule.DatabaseSchemaPlan || DatabaseSchemaPlanModule;
const DatabaseSchemaValidator = DatabaseSchemaValidatorModule.DatabaseSchemaValidator || DatabaseSchemaValidatorModule;
const DatabaseSchemaGenerator = DatabaseSchemaGeneratorModule.DatabaseSchemaGenerator || DatabaseSchemaGeneratorModule;
const DatabaseMigrationManager = DatabaseMigrationManagerModule.DatabaseMigrationManager || DatabaseMigrationManagerModule;
const DatabaseSchemaResult = DatabaseSchemaResultModule.DatabaseSchemaResult || DatabaseSchemaResultModule;

module.exports = {
  DatabaseSchemaPlan,
  DatabaseSchemaValidator,
  DatabaseSchemaGenerator,
  DatabaseMigrationManager,
  DatabaseSchemaResult
};
