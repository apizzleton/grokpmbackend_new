const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

// Initialize Express
const app = express();

// CORS Configuration
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',') 
      : ['https://grokpmfrontend.onrender.com', 'http://localhost:3000'];
    if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.log(`[${new Date().toISOString()}] CORS blocked request from origin: ${origin}`);
      callback(new Error('CORS policy: Origin not allowed'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.options('*', cors());

// Request Logging Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] Received ${req.method} request for ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  next();
});

// Error Logging Middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error in middleware: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Parse JSON requests
app.use(express.json());

// Database Configuration
const sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { 
      require: true, 
      rejectUnauthorized: false 
    }
  },
  logging: (msg) => console.log(`[${new Date().toISOString()}] SQL: ${msg}`), // Detailed SQL logging
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

// Define Models
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
  propertyId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Properties', key: 'id' } 
  },
  unit_number: DataTypes.STRING,
  rent_amount: DataTypes.FLOAT,
  status: DataTypes.STRING
});

const Tenant = sequelize.define('Tenant', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  unit_id: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Units', key: 'id' } 
  },
  lease_start_date: DataTypes.DATE,
  lease_end_date: DataTypes.DATE,
  rent: DataTypes.FLOAT
});

const Owner = sequelize.define('Owner', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  property_id: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Properties', key: 'id' } 
  }
});

const Association = sequelize.define('Association', {
  name: DataTypes.STRING,
  contact_info: DataTypes.STRING,
  fee: DataTypes.FLOAT,
  due_date: DataTypes.DATE,
  property_id: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Properties', key: 'id' } 
  }
});

const BoardMember = sequelize.define('BoardMember', {
  name: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  association_id: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Associations', key: 'id' } 
  }
});

const Account = sequelize.define('Account', {
  name: DataTypes.STRING,
  accountTypeId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'AccountTypes', key: 'id' } 
  }
});

const AccountType = sequelize.define('AccountType', {
  name: DataTypes.STRING
});

const Transaction = sequelize.define('Transaction', {
  accountId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Accounts', key: 'id' } 
  },
  transactionTypeId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'TransactionTypes', key: 'id' } 
  },
  propertyId: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Properties', key: 'id' } 
  },
  amount: DataTypes.FLOAT,
  date: DataTypes.DATE,
  description: DataTypes.STRING
});

const TransactionType = sequelize.define('TransactionType', {
  name: DataTypes.STRING
});

const Payment = sequelize.define('Payment', {
  tenant_id: { 
    type: DataTypes.INTEGER, 
    references: { model: 'Tenants', key: 'id' } 
  },
  amount: DataTypes.FLOAT,
  date: DataTypes.DATE,
  status: DataTypes.STRING
});

// Define Relationships
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

// Database Sync and Seed Function
const syncModels = async () => {
  try {
    await sequelize.authenticate();
    console.log(`[${new Date().toISOString()}] Database connection established successfully`);

    await sequelize.sync({ force: false });
    console.log(`[${new Date().toISOString()}] Database synced successfully`);

    // Seed data only if the tables are empty
    const propertyCount = await Property.count();
    if (propertyCount === 0) {
      const [assetType, liabilityType, incomeType, expenseType] = await AccountType.bulkCreate([
        { name: 'Asset' }, 
        { name: 'Liability' }, 
        { name: 'Income' }, 
        { name: 'Expense' }
      ]);
      
      await TransactionType.bulkCreate([
        { name: 'Income' }, 
        { name: 'Expense' }, 
        { name: 'Transfer' }
      ]);
      
      const [prop1, prop2] = await Property.bulkCreate([
        { 
          name: 'Main St Property', 
          address: '123 Main St', 
          status: 'active', 
          city: 'Portland', 
          state: 'OR', 
          zip: '97201', 
          value: 500000 
        },
        { 
          name: 'Oak Ave Property', 
          address: '456 Oak Ave', 
          status: 'active', 
          city: 'Seattle', 
          state: 'WA', 
          zip: '98101', 
          value: 600000 
        }
      ]);
      
      await Owner.bulkCreate([
        { 
          name: 'John Doe', 
          email: 'john@example.com', 
          phone: '555-0101', 
          property_id: prop1.id 
        }
      ]);
      
      await Unit.bulkCreate([
        { 
          propertyId: prop1.id, 
          unit_number: '101', 
          rent_amount: 1200, 
          status: 'occupied' 
        },
        { 
          propertyId: prop2.id, 
          unit_number: '201', 
          rent_amount: 1500, 
          status: 'vacant' 
        }
      ]);
      
      await Tenant.bulkCreate([
        { 
          name: 'Jane Smith', 
          email: 'jane@example.com', 
          phone: '555-0102', 
          unit_id: 1, 
          lease_start_date: new Date(), 
          lease_end_date: new Date(2026, 0, 1), 
          rent: 1200 
        }
      ]);
      
      await Association.bulkCreate([
        { 
          name: 'Main St HOA', 
          contact_info: 'hoa@mainst.com', 
          fee: 100, 
          due_date: new Date(), 
          property_id: prop1.id 
        }
      ]);
      
      await BoardMember.bulkCreate([
        { 
          name: 'Alice Brown', 
          email: 'alice@example.com', 
          phone: '555-0103', 
          association_id: 1 
        }
      ]);
      
      await Account.bulkCreate([
        { name: 'Rent Income', accountTypeId: incomeType.id }, 
        { name: 'Maintenance Expense', accountTypeId: expenseType.id }
      ]);
      
      await Transaction.bulkCreate([
        { 
          accountId: 1, 
          transactionTypeId: 1, 
          propertyId: prop1.id, 
          amount: 1200, 
          date: new Date(), 
          description: 'Rent Payment' 
        },
        { 
          accountId: 2, 
          transactionTypeId: 2, 
          propertyId: prop2.id, 
          amount: 500, 
          date: new Date(), 
          description: 'Maintenance' 
        }
      ]);
      
      await Payment.bulkCreate([
        { 
          tenant_id: 1, 
          amount: 1200, 
          date: new Date(), 
          status: 'paid' 
        }
      ]);
      
      console.log(`[${new Date().toISOString()}] Initial data seeded successfully`);
    } else {
      console.log(`[${new Date().toISOString()}] Tables already contain data; skipping seeding.`);
    }
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to sync database:`, error);
    process.exit(1); // Exit if DB fails
  }
};

// Initialize database and seed data
syncModels();

// API Routes
app.get('/api/properties', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching properties...`);
    const properties = await Property.findAll({ 
      include: [Owner, Unit, Association, Transaction] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${properties.length} properties`);
    res.json(properties);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/properties:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating property:`, req.body);
    const property = await Property.create(req.body);
    res.status(201).json(property);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/properties:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/units', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching units...`);
    const units = await Unit.findAll({ 
      include: [Property, Tenant] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${units.length} units`);
    res.json(units);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/units:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/units', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating unit:`, req.body);
    const unit = await Unit.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/units:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/tenants', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching tenants...`);
    const tenants = await Tenant.findAll({ 
      include: [Unit, Payment] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${tenants.length} tenants`);
    res.json(tenants);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/tenants:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating tenant:`, req.body);
    const tenant = await Tenant.create(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/tenants:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/owners', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching owners...`);
    const owners = await Owner.findAll({ 
      include: [Property] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${owners.length} owners`);
    res.json(owners);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/owners:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/owners', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating owner:`, req.body);
    const owner = await Owner.create(req.body);
    res.status(201).json(owner);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/owners:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/associations', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching associations...`);
    const associations = await Association.findAll({ 
      include: [Property, BoardMember] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${associations.length} associations`);
    res.json(associations);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/associations:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/associations', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating association:`, req.body);
    const association = await Association.create(req.body);
    res.status(201).json(association);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/associations:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/board-members', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching board members...`);
    const boardMembers = await BoardMember.findAll({ 
      include: [Association] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${boardMembers.length} board members`);
    res.json(boardMembers);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/board-members:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/board-members', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating board member:`, req.body);
    const boardMember = await BoardMember.create(req.body);
    res.status(201).json(boardMember);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/board-members:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching accounts...`);
    const accounts = await Account.findAll({ 
      include: [AccountType, Transaction] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${accounts.length} accounts`);
    res.json(accounts);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/accounts:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating account:`, req.body);
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/accounts:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/account-types', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching account types...`);
    const accountTypes = await AccountType.findAll();
    console.log(`[${new Date().toISOString()}] Sending ${accountTypes.length} account types`);
    res.json(accountTypes);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/account-types:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/account-types', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating account type:`, req.body);
    const accountType = await AccountType.create(req.body);
    res.status(201).json(accountType);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/account-types:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching transactions...`);
    const transactions = await Transaction.findAll({ 
      include: [Account, TransactionType, Property] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${transactions.length} transactions`);
    res.json(transactions);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/transactions:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating transaction:`, req.body);
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/transactions:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching payments...`);
    const payments = await Payment.findAll({ 
      include: [Tenant] 
    });
    console.log(`[${new Date().toISOString()}] Sending ${payments.length} payments`);
    res.json(payments);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/payments:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating payment:`, req.body);
    const payment = await Payment.create(req.body);
    res.status(201).json(payment);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/payments:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/transaction-types', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Fetching transaction types...`);
    const transactionTypes = await TransactionType.findAll();
    console.log(`[${new Date().toISOString()}] Sending ${transactionTypes.length} transaction types`);
    res.json(transactionTypes);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in /api/transaction-types:`, error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transaction-types', async (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] Creating transaction type:`, req.body);
    const transactionType = await TransactionType.create(req.body);
    res.status(201).json(transactionType);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in POST /api/transaction-types:`, error);
    res.status(400).json({ error: error.message });
  }
});

// Start the Server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(`[${new Date().toISOString()}] Uncaught Exception: ${err.message}`, err.stack);
  server.close(() => process.exit(1));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(`[${new Date().toISOString()}] Unhandled Rejection at: ${promise}, reason: ${reason.message}`, reason.stack);
  server.close(() => process.exit(1));
});

module.exports = app; // Export for testing purposes