// C:\Users\AnthonyParadiso\Desktop\grokPMApp\backend_new\server.js

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();

// Manual CORS Configuration with Environment Variable Support
app.use((req, res, next) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['https://grokpmfrontend.onrender.com', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  } else {
    res.status(403).send('CORS policy: Origin not allowed');
    return;
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204); // Handle preflight requests
  } else {
    next();
  }
});

// Request Logging for Debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  next();
});

// Parse JSON requests
app.use(express.json());

// Database Configuration
const sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false
});

// Models
const Property = sequelize.define('Property', {
  name: DataTypes.STRING,
  address: DataTypes.STRING,
  status: DataTypes.STRING,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  zip: DataTypes.STRING,
  value: DataTypes.FLOAT,
  owner_id: DataTypes.INTEGER
});

const Unit = sequelize.define('Unit', {
  propertyId: { type: DataTypes.INTEGER, references: { model: 'Properties', key: 'id' } },
  unit_number: DataTypes.STRING,
  rent_amount: DataTypes.FLOAT,
  status: DataTypes.STRING
});

const Tenant = sequelize.define('Tenant', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  unit_id: { type: DataTypes.INTEGER, references: { model: 'Units', key: 'id' } },
  lease_start_date: DataTypes.DATE,
  lease_end_date: DataTypes.DATE,
  rent: DataTypes.FLOAT
});

const Owner = sequelize.define('Owner', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  property_id: { type: DataTypes.INTEGER, references: { model: 'Properties', key: 'id' } }
});

const Association = sequelize.define('Association', {
  name: DataTypes.STRING,
  contact_info: DataTypes.STRING,
  fee: DataTypes.FLOAT,
  due_date: DataTypes.DATE,
  property_id: { type: DataTypes.INTEGER, references: { model: 'Properties', key: 'id' } }
});

const BoardMember = sequelize.define('BoardMember', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  association_id: { type: DataTypes.INTEGER, references: { model: 'Associations', key: 'id' } }
});

const Account = sequelize.define('Account', {
  name: DataTypes.STRING,
  accountTypeId: { type: DataTypes.INTEGER, references: { model: 'AccountTypes', key: 'id' } }
});

const AccountType = sequelize.define('AccountType', {
  name: DataTypes.STRING
});

const Transaction = sequelize.define('Transaction', {
  accountId: { type: DataTypes.INTEGER, references: { model: 'Accounts', key: 'id' } },
  transactionTypeId: { type: DataTypes.INTEGER, references: { model: 'TransactionTypes', key: 'id' } },
  propertyId: { type: DataTypes.INTEGER, references: { model: 'Properties', key: 'id' } },
  amount: DataTypes.FLOAT,
  date: DataTypes.DATE,
  description: DataTypes.STRING
});

const TransactionType = sequelize.define('TransactionType', {
  name: DataTypes.STRING
});

const Payment = sequelize.define('Payment', {
  tenant_id: { type: DataTypes.INTEGER, references: { model: 'Tenants', key: 'id' } },
  amount: DataTypes.FLOAT,
  date: DataTypes.DATE,
  status: DataTypes.STRING
});

// Relationships
Property.hasMany(Unit, { foreignKey: 'propertyId' });
Unit.belongsTo(Property, { foreignKey: 'propertyId' });

Unit.hasMany(Tenant, { foreignKey: 'unit_id' });
Tenant.belongsTo(Unit, { foreignKey: 'unit_id' });

Owner.hasMany(Property, { foreignKey: 'owner_id' });
Property.belongsTo(Owner, { foreignKey: 'owner_id' });

Property.hasMany(Association, { foreignKey: 'property_id' });
Association.belongsTo(Property, { foreignKey: 'property_id' });

Association.hasMany(BoardMember, { foreignKey: 'association_id' });
BoardMember.belongsTo(Association, { foreignKey: 'association_id' });

AccountType.hasMany(Account, { foreignKey: 'accountTypeId' });
Account.belongsTo(AccountType, { foreignKey: 'accountTypeId' });

Account.hasMany(Transaction, { foreignKey: 'accountId' });
Transaction.belongsTo(Account, { foreignKey: 'accountId' });

TransactionType.hasMany(Transaction, { foreignKey: 'transactionTypeId' });
Transaction.belongsTo(TransactionType, { foreignKey: 'transactionTypeId' });

Property.hasMany(Transaction, { foreignKey: 'propertyId' });
Transaction.belongsTo(Property, { foreignKey: 'propertyId' });

Tenant.hasMany(Payment, { foreignKey: 'tenant_id' });
Payment.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// Sync and Seed
const syncModels = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully');

    await sequelize.sync({ force: true }); // Use { force: false } in production
    console.log('Database synced successfully');

    const [assetType, liabilityType, incomeType, expenseType] = await AccountType.bulkCreate([
      { name: 'Asset' }, { name: 'Liability' }, { name: 'Income' }, { name: 'Expense' }
    ]);
    await TransactionType.bulkCreate([{ name: 'Income' }, { name: 'Expense' }, { name: 'Transfer' }]);
    const [prop1, prop2] = await Property.bulkCreate([
      { name: 'Main St Property', address: '123 Main St', status: 'active', city: 'Portland', state: 'OR', zip: '97201', value: 500000 },
      { name: 'Oak Ave Property', address: '456 Oak Ave', status: 'active', city: 'Seattle', state: 'WA', zip: '98101', value: 600000 }
    ]);
    await Owner.bulkCreate([{ name: 'John Doe', email: 'john@example.com', phone: '555-0101', property_id: prop1.id }]);
    await Unit.bulkCreate([
      { propertyId: prop1.id, unit_number: '101', rent_amount: 1200, status: 'occupied' },
      { propertyId: prop2.id, unit_number: '201', rent_amount: 1500, status: 'vacant' }
    ]);
    await Tenant.bulkCreate([{ name: 'Jane Smith', email: 'jane@example.com', phone: '555-0102', unit_id: 1, lease_start_date: new Date(), lease_end_date: new Date(2026, 0, 1), rent: 1200 }]);
    await Association.bulkCreate([{ name: 'Main St HOA', contact_info: 'hoa@mainst.com', fee: 100, due_date: new Date(), property_id: prop1.id }]);
    await BoardMember.bulkCreate([{ name: 'Alice Brown', email: 'alice@example.com', phone: '555-0103', association_id: 1 }]);
    await Account.bulkCreate([{ name: 'Rent Income', accountTypeId: incomeType.id }, { name: 'Maintenance Expense', accountTypeId: expenseType.id }]);
    await Transaction.bulkCreate([
      { accountId: 1, transactionTypeId: 1, propertyId: prop1.id, amount: 1200, date: new Date(), description: 'Rent Payment' },
      { accountId: 2, transactionTypeId: 2, propertyId: prop2.id, amount: 500, date: new Date(), description: 'Maintenance' }
    ]);
    await Payment.bulkCreate([{ tenant_id: 1, amount: 1200, date: new Date(), status: 'paid' }]);
    console.log('Initial data seeded successfully');
  } catch (error) {
    console.error('Error syncing models or seeding data:', error);
  }
};

syncModels();

// API Routes
// Properties
app.get('/api/properties', async (req, res) => {
  try {
    const properties = await Property.findAll({ include: [Owner, Unit, Association, Transaction] });
    res.json(properties);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const property = await Property.create(req.body);
    res.status(201).json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    await property.update(req.body);
    res.json(property);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    const property = await Property.findByPk(req.params.id);
    if (!property) return res.status(404).json({ error: 'Property not found' });
    await property.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Units
app.get('/api/units', async (req, res) => {
  try {
    const units = await Unit.findAll({ include: [Property, Tenant] });
    res.json(units);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/units', async (req, res) => {
  try {
    const unit = await Unit.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/units/:id', async (req, res) => {
  try {
    const unit = await Unit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await unit.update(req.body);
    res.json(unit);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/units/:id', async (req, res) => {
  try {
    const unit = await Unit.findByPk(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    await unit.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Tenants
app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.findAll({ include: [Unit, Payment] });
    res.json(tenants);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = await Tenant.create(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    await tenant.update(req.body);
    res.json(tenant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/tenants/:id', async (req, res) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    await tenant.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Owners
app.get('/api/owners', async (req, res) => {
  try {
    const owners = await Owner.findAll({ include: [Property] });
    res.json(owners);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/owners', async (req, res) => {
  try {
    const owner = await Owner.create(req.body);
    res.status(201).json(owner);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/owners/:id', async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.update(req.body);
    res.json(owner);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/owners/:id', async (req, res) => {
  try {
    const owner = await Owner.findByPk(req.params.id);
    if (!owner) return res.status(404).json({ error: 'Owner not found' });
    await owner.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Associations
app.get('/api/associations', async (req, res) => {
  try {
    const associations = await Association.findAll({ include: [Property, BoardMember] });
    res.json(associations);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/associations', async (req, res) => {
  try {
    const association = await Association.create(req.body);
    res.status(201).json(association);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/associations/:id', async (req, res) => {
  try {
    const association = await Association.findByPk(req.params.id);
    if (!association) return res.status(404).json({ error: 'Association not found' });
    await association.update(req.body);
    res.json(association);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/associations/:id', async (req, res) => {
  try {
    const association = await Association.findByPk(req.params.id);
    if (!association) return res.status(404).json({ error: 'Association not found' });
    await association.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Board Members
app.get('/api/board-members', async (req, res) => {
  try {
    const boardMembers = await BoardMember.findAll({ include: [Association] });
    res.json(boardMembers);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/board-members', async (req, res) => {
  try {
    const boardMember = await BoardMember.create(req.body);
    res.status(201).json(boardMember);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/board-members/:id', async (req, res) => {
  try {
    const boardMember = await BoardMember.findByPk(req.params.id);
    if (!boardMember) return res.status(404).json({ error: 'Board Member not found' });
    await boardMember.update(req.body);
    res.json(boardMember);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/board-members/:id', async (req, res) => {
  try {
    const boardMember = await BoardMember.findByPk(req.params.id);
    if (!boardMember) return res.status(404).json({ error: 'Board Member not found' });
    await boardMember.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.findAll({ include: [AccountType, Transaction] });
    res.json(accounts);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.update(req.body);
    res.json(account);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });
    await account.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Account Types
app.get('/api/account-types', async (req, res) => {
  try {
    const accountTypes = await AccountType.findAll();
    res.json(accountTypes);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/account-types', async (req, res) => {
  try {
    const accountType = await AccountType.create(req.body);
    res.status(201).json(accountType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/account-types/:id', async (req, res) => {
  try {
    const accountType = await AccountType.findByPk(req.params.id);
    if (!accountType) return res.status(404).json({ error: 'Account Type not found' });
    await accountType.update(req.body);
    res.json(accountType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/account-types/:id', async (req, res) => {
  try {
    const accountType = await AccountType.findByPk(req.params.id);
    if (!accountType) return res.status(404).json({ error: 'Account Type not found' });
    await accountType.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.findAll({ include: [Account, AccountType, TransactionType, Property] });
    res.json(transactions);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    await transaction.update(req.body);
    res.json(transaction);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    await transaction.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Transaction Types
app.get('/api/transaction-types', async (req, res) => {
  try {
    const transactionTypes = await TransactionType.findAll();
    res.json(transactionTypes);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/transaction-types', async (req, res) => {
  try {
    const transactionType = await TransactionType.create(req.body);
    res.status(201).json(transactionType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/transaction-types/:id', async (req, res) => {
  try {
    const transactionType = await TransactionType.findByPk(req.params.id);
    if (!transactionType) return res.status(404).json({ error: 'Transaction Type not found' });
    await transactionType.update(req.body);
    res.json(transactionType);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/transaction-types/:id', async (req, res) => {
  try {
    const transactionType = await TransactionType.findByPk(req.params.id);
    if (!transactionType) return res.status(404).json({ error: 'Transaction Type not found' });
    await transactionType.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Payments
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await Payment.findAll({ include: [Tenant] });
    res.json(payments);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = await Payment.create(req.body);
    res.status(201).json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    await payment.update(req.body);
    res.json(payment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    await payment.destroy();
    res.status(204).send();
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Start the Server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));