const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();

// CORS middleware to handle preflight requests
app.use((req, res, next) => {
  const allowedOrigins = [
    'https://grokpmfrontend.onrender.com',
    'http://localhost:3002'
  ];
  const origin = req.headers.origin;
  
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json());

// Request Logging Middleware
app.use((req, res, next) => {
  if (req.method !== 'HEAD') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  }
  next();
});

// Error Logging Middleware
app.use((err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error: ${err.message}`, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Database Configuration
const sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { 
      require: true, 
      rejectUnauthorized: false 
    }
  },
  logging: false,
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
  property_type: {
    type: DataTypes.STRING,
    defaultValue: 'residential'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  value: DataTypes.FLOAT,
  owner_id: DataTypes.INTEGER
});

const PropertyAddress = sequelize.define('PropertyAddress', {
  property_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'Properties', key: 'id' }
  },
  street: DataTypes.STRING,
  city: DataTypes.STRING,
  state: DataTypes.STRING,
  zip: DataTypes.STRING,
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

const Unit = sequelize.define('Unit', {
  address_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'PropertyAddresses', key: 'id' }
  },
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

// Define Relationships
Property.hasMany(PropertyAddress, { foreignKey: 'property_id', as: 'addresses' });
PropertyAddress.belongsTo(Property, { foreignKey: 'property_id' });

PropertyAddress.hasMany(Unit, { foreignKey: 'address_id', as: 'units' });
Unit.belongsTo(PropertyAddress, { foreignKey: 'address_id' });

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

// API Routes
app.get('/api/properties', async (req, res) => {
  try {
    const properties = await Property.findAll({
      include: [{
        model: PropertyAddress,
        as: 'addresses',
        include: [{
          model: Unit,
          as: 'units'
        }]
      }]
    });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

app.post('/api/properties', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log(`[${new Date().toISOString()}] Creating new property with data:`, JSON.stringify(req.body, null, 2));
    const { name, property_type, status, value, owner_id, addresses } = req.body;
    
    // Create property
    const property = await Property.create({
      name,
      property_type,
      status,
      value: value === '' ? 0 : parseFloat(value),
      owner_id: owner_id || null
    }, { transaction: t });

    console.log(`[${new Date().toISOString()}] Created property:`, JSON.stringify(property, null, 2));

    // Create addresses
    if (addresses && addresses.length > 0) {
      console.log(`[${new Date().toISOString()}] Creating ${addresses.length} addresses for property ${property.id}`);
      const addressPromises = addresses.map((addr, index) => 
        PropertyAddress.create({
          ...addr,
          property_id: property.id,
          is_primary: index === 0 // First address is primary by default
        }, { transaction: t })
      );
      await Promise.all(addressPromises);
    }

    await t.commit();
    console.log(`[${new Date().toISOString()}] Successfully committed transaction`);

    // Fetch the created property with its addresses
    const createdProperty = await Property.findByPk(property.id, {
      include: [{
        model: PropertyAddress,
        as: 'addresses'
      }]
    });

    res.status(201).json(createdProperty);
  } catch (error) {
    await t.rollback();
    console.error('Error creating property:', {
      message: error.message,
      stack: error.stack,
      requestBody: req.body
    });
    res.status(500).json({ 
      error: 'Failed to create property',
      details: error.message 
    });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, property_type, status, value, owner_id, addresses } = req.body;

    // Update property
    await Property.update({
      name,
      property_type,
      status,
      value: value === '' ? 0 : value,
      owner_id
    }, { 
      where: { id },
      transaction: t 
    });

    // Update addresses
    if (addresses) {
      // Delete removed addresses
      const addressIds = addresses.filter(addr => addr.id).map(addr => addr.id);
      await PropertyAddress.destroy({
        where: {
          property_id: id,
          id: { [Sequelize.Op.notIn]: addressIds }
        },
        transaction: t
      });

      // Update or create addresses
      for (const [index, addr] of addresses.entries()) {
        if (addr.id) {
          await PropertyAddress.update(
            { ...addr, is_primary: index === 0 },
            { where: { id: addr.id }, transaction: t }
          );
        } else {
          await PropertyAddress.create(
            { ...addr, property_id: id, is_primary: index === 0 },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();

    // Fetch updated property
    const updatedProperty = await Property.findByPk(id, {
      include: [{
        model: PropertyAddress,
        as: 'addresses',
        include: [{
          model: Unit,
          as: 'units'
        }]
      }]
    });

    res.json(updatedProperty);
  } catch (error) {
    await t.rollback();
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

app.post('/api/properties/:propertyId/addresses', async (req, res) => {
  try {
    const { propertyId } = req.params;
    const address = await PropertyAddress.create({
      ...req.body,
      property_id: propertyId
    });
    res.status(201).json(address);
  } catch (error) {
    console.error('Error creating address:', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
});

app.put('/api/properties/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await PropertyAddress.update(req.body, {
      where: { id }
    });
    const updatedAddress = await PropertyAddress.findByPk(id);
    res.json(updatedAddress);
  } catch (error) {
    console.error('Error updating address:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

app.delete('/api/properties/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await PropertyAddress.destroy({
      where: { id }
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

app.get('/api/units', async (req, res) => {
  try {
    const units = await Unit.findAll({ include: [PropertyAddress, Tenant] });
    res.json(units);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

app.post('/api/units', async (req, res) => {
  try {
    const unit = await Unit.create(req.body);
    res.status(201).json(unit);
  } catch (error) {
    console.error('Error creating unit:', error);
    res.status(500).json({ error: 'Failed to create unit' });
  }
});

app.get('/api/tenants', async (req, res) => {
  try {
    const tenants = await Tenant.findAll({ include: [Unit, Payment] });
    res.json(tenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.post('/api/tenants', async (req, res) => {
  try {
    const tenant = await Tenant.create(req.body);
    res.status(201).json(tenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

app.get('/api/owners', async (req, res) => {
  try {
    const owners = await Owner.findAll({ include: [Property] });
    res.json(owners);
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ error: 'Failed to fetch owners' });
  }
});

app.post('/api/owners', async (req, res) => {
  try {
    const owner = await Owner.create(req.body);
    res.status(201).json(owner);
  } catch (error) {
    console.error('Error creating owner:', error);
    res.status(500).json({ error: 'Failed to create owner' });
  }
});

app.get('/api/associations', async (req, res) => {
  try {
    const associations = await Association.findAll({ include: [Property, BoardMember] });
    res.json(associations);
  } catch (error) {
    console.error('Error fetching associations:', error);
    res.status(500).json({ error: 'Failed to fetch associations' });
  }
});

app.post('/api/associations', async (req, res) => {
  try {
    const association = await Association.create(req.body);
    res.status(201).json(association);
  } catch (error) {
    console.error('Error creating association:', error);
    res.status(500).json({ error: 'Failed to create association' });
  }
});

app.get('/api/board-members', async (req, res) => {
  try {
    const boardMembers = await BoardMember.findAll({ include: [Association] });
    res.json(boardMembers);
  } catch (error) {
    console.error('Error fetching board members:', error);
    res.status(500).json({ error: 'Failed to fetch board members' });
  }
});

app.post('/api/board-members', async (req, res) => {
  try {
    const boardMember = await BoardMember.create(req.body);
    res.status(201).json(boardMember);
  } catch (error) {
    console.error('Error creating board member:', error);
    res.status(500).json({ error: 'Failed to create board member' });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.findAll({ include: [AccountType, Transaction] });
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const account = await Account.create(req.body);
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.get('/api/account-types', async (req, res) => {
  try {
    const accountTypes = await AccountType.findAll();
    res.json(accountTypes);
  } catch (error) {
    console.error('Error fetching account types:', error);
    res.status(500).json({ error: 'Failed to fetch account types' });
  }
});

app.post('/api/account-types', async (req, res) => {
  try {
    const accountType = await AccountType.create(req.body);
    res.status(201).json(accountType);
  } catch (error) {
    console.error('Error creating account type:', error);
    res.status(500).json({ error: 'Failed to create account type' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.findAll({ include: [Account, TransactionType, Property] });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const transaction = await Transaction.create(req.body);
    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.get('/api/payments', async (req, res) => {
  try {
    const payments = await Payment.findAll({ include: [Tenant] });
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

app.post('/api/payments', async (req, res) => {
  try {
    const payment = await Payment.create(req.body);
    res.status(201).json(payment);
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

app.get('/api/transaction-types', async (req, res) => {
  try {
    const transactionTypes = await TransactionType.findAll();
    res.json(transactionTypes);
  } catch (error) {
    console.error('Error fetching transaction types:', error);
    res.status(500).json({ error: 'Failed to fetch transaction types' });
  }
});

app.post('/api/transaction-types', async (req, res) => {
  try {
    const transactionType = await TransactionType.create(req.body);
    res.status(201).json(transactionType);
  } catch (error) {
    console.error('Error creating transaction type:', error);
    res.status(500).json({ error: 'Failed to create transaction type' });
  }
});

// PUT and DELETE endpoints for Properties
app.delete('/api/properties/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    console.log(`[${new Date().toISOString()}] Attempting to delete property with ID: ${id}`);

    // Delete associated addresses first (this will cascade to units)
    await PropertyAddress.destroy({
      where: { property_id: id },
      transaction: t
    });

    // Delete the property
    await Property.destroy({
      where: { id },
      transaction: t
    });

    await t.commit();
    res.status(204).send();
  } catch (error) {
    await t.rollback();
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByPk(id);
    
    if (!property) {
      return res.status(404).json({ error: `Property with ID ${id} not found` });
    }
    
    await property.update(req.body);
    res.json(property);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in PUT /api/properties/${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

// PUT and DELETE endpoints for Units
app.put('/api/units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id);
    
    if (!unit) {
      return res.status(404).json({ error: `Unit with ID ${id} not found` });
    }
    
    await unit.update(req.body);
    res.json(unit);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in PUT /api/units/${req.params.id}:`, error);
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[${new Date().toISOString()}] Attempting to delete unit with ID: ${id}`);
    
    const unit = await Unit.findByPk(id);
    
    if (!unit) {
      console.log(`[${new Date().toISOString()}] Unit with ID ${id} not found for deletion`);
      return res.status(404).json({ error: `Unit with ID ${id} not found` });
    }
    
    // Delete associated tenants first
    await Tenant.destroy({ where: { unit_id: id } });
    
    // Delete the unit
    await unit.destroy();
    console.log(`[${new Date().toISOString()}] Successfully deleted unit with ID: ${id}`);
    
    res.status(200).json({ message: `Unit with ID ${id} successfully deleted` });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error in DELETE /api/units/${req.params.id}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Database Sync and Seed Function
const syncModels = async () => {
  try {
    await sequelize.authenticate();
    console.log(`[${new Date().toISOString()}] Database connection established successfully`);

    await sequelize.sync({ alter: true });
    console.log(`[${new Date().toISOString()}] Database synced successfully`);
  } catch (error) {
    console.error('Database sync error:', error);
    process.exit(1);
  }
};

// Initialize database and seed data
syncModels();

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});