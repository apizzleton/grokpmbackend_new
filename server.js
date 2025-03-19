const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const app = express();

// Enable CORS for all origins with all options
app.use(cors({
  origin: true, // Reflect the request origin
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Handle OPTIONS requests explicitly
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));

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

const AccountType = sequelize.define('AccountType', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.STRING
  }
});

const Account = sequelize.define('Account', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  accountTypeId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

const Transaction = sequelize.define('Transaction', {
  date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  description: {
    type: DataTypes.STRING,
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  propertyId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

const Payment = sequelize.define('Payment', {
  tenant_id: { type: DataTypes.INTEGER, references: { model: 'Tenants', key: 'id' } },
  amount: DataTypes.FLOAT,
  date: DataTypes.DATE,
  status: DataTypes.STRING
});

// Define Maintenance model
const Maintenance = sequelize.define('Maintenance', {
  title: DataTypes.STRING,
  description: DataTypes.TEXT,
  priority: {
    type: DataTypes.STRING,
    defaultValue: 'medium'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'open'
  },
  property_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'Properties', key: 'id' }
  },
  unit_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'Units', key: 'id' }
  },
  reported_by: DataTypes.STRING,
  assigned_to: DataTypes.STRING,
  due_date: DataTypes.DATE
});

// Define Photo model
const Photo = sequelize.define('Photo', {
  property_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'Properties', key: 'id' }
  },
  unit_id: { 
    type: DataTypes.INTEGER,
    references: { model: 'Units', key: 'id' }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  url: {
    type: DataTypes.TEXT('long'),
    allowNull: false
  },
  is_main: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Define Subscription Plan model
const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  billing_cycle: {
    type: DataTypes.STRING,
    defaultValue: 'monthly'
  },
  features: {
    type: DataTypes.JSON
  }
});

// Define Subscription model
const Subscription = sequelize.define('Subscription', {
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  plan_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'SubscriptionPlans',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'active'
  },
  start_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATE
  },
  payment_method: {
    type: DataTypes.STRING
  }
});

// Define Portfolio model
const Portfolio = sequelize.define('Portfolio', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

// Define PortfolioProperty junction model for many-to-many relationship
const PortfolioProperty = sequelize.define('PortfolioProperty', {
  portfolio_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Portfolios',
      key: 'id'
    }
  },
  property_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'Properties',
      key: 'id'
    }
  }
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

Account.belongsTo(AccountType, { foreignKey: 'accountTypeId' });
AccountType.hasMany(Account, { foreignKey: 'accountTypeId' });
Transaction.belongsTo(Account, { foreignKey: 'accountId' });
Account.hasMany(Transaction, { foreignKey: 'accountId' });
Transaction.belongsTo(Property, { foreignKey: 'propertyId' });
Property.hasMany(Transaction, { foreignKey: 'propertyId' });

Tenant.hasMany(Payment, { foreignKey: 'tenant_id' });
Payment.belongsTo(Tenant, { foreignKey: 'tenant_id' });

// Maintenance relationships
Property.hasMany(Maintenance, { foreignKey: 'property_id', as: 'maintenance' });
Maintenance.belongsTo(Property, { foreignKey: 'property_id' });

Unit.hasMany(Maintenance, { foreignKey: 'unit_id', as: 'maintenance' });
Maintenance.belongsTo(Unit, { foreignKey: 'unit_id' });

// Photo relationships
Property.hasMany(Photo, { foreignKey: 'property_id', as: 'photos' });
Photo.belongsTo(Property, { foreignKey: 'property_id' });

Unit.hasMany(Photo, { foreignKey: 'unit_id', as: 'photos' });
Photo.belongsTo(Unit, { foreignKey: 'unit_id' });

// Subscription relationships
SubscriptionPlan.hasMany(Subscription, { foreignKey: 'plan_id' });
Subscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id' });

// Portfolio relationships
Portfolio.belongsToMany(Property, { through: PortfolioProperty });
Property.belongsToMany(Portfolio, { through: PortfolioProperty });

// API Routes
app.get('/api/properties', async (req, res) => {
  try {
    const properties = await Property.findAll({
      include: [
        {
          model: PropertyAddress,
          as: 'addresses',
          include: [
            {
              model: Unit,
              as: 'units'
            }
          ]
        },
        {
          model: Photo,
          as: 'photos'
        }
      ]
    });
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const property = await Property.findByPk(id, {
      include: [
        {
          model: PropertyAddress,
          as: 'addresses',
          include: [
            {
              model: Unit,
              as: 'units'
            }
          ]
        },
        {
          model: Photo,
          as: 'photos'
        }
      ]
    });
    
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
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
      include: [
        {
          model: PropertyAddress,
          as: 'addresses',
          include: [
            {
              model: Unit,
              as: 'units'
            }
          ]
        },
        {
          model: Photo,
          as: 'photos'
        }
      ]
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
    const { name, property_type, status, value, owner_id, addresses, photos } = req.body;

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

    // Handle photos if provided
    if (photos) {
      // Get existing photos
      const existingPhotos = await Photo.findAll({
        where: { property_id: id },
        transaction: t
      });
      
      const existingPhotoIds = existingPhotos.map(p => p.id);
      const updatedPhotoIds = photos.filter(p => p.id).map(p => p.id);
      
      // Delete photos that are no longer in the updated list
      const photosToDelete = existingPhotoIds.filter(id => !updatedPhotoIds.includes(id));
      if (photosToDelete.length > 0) {
        await Photo.destroy({
          where: {
            id: { [Sequelize.Op.in]: photosToDelete }
          },
          transaction: t
        });
      }
      
      // Update or create photos
      for (const photo of photos) {
        if (photo.id) {
          // Update existing photo
          await Photo.update(
            { 
              name: photo.name,
              is_main: photo.is_main
            },
            { where: { id: photo.id }, transaction: t }
          );
        } else {
          // Create new photo
          await Photo.create(
            {
              property_id: id,
              name: photo.name,
              url: photo.url,
              is_main: photo.is_main
            },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();

    // Fetch updated property
    const updatedProperty = await Property.findByPk(id, {
      include: [
        {
          model: PropertyAddress,
          as: 'addresses',
          include: [
            {
              model: Unit,
              as: 'units'
            }
          ]
        },
        {
          model: Photo,
          as: 'photos'
        }
      ]
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
    const units = await Unit.findAll({ 
      include: [
        PropertyAddress, 
        Tenant,
        {
          model: Photo,
          as: 'photos'
        }
      ] 
    });
    res.json(units);
  } catch (error) {
    console.error('Error fetching units:', error);
    res.status(500).json({ error: 'Failed to fetch units' });
  }
});

app.get('/api/units/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const unit = await Unit.findByPk(id, {
      include: [
        PropertyAddress, 
        Tenant,
        {
          model: Photo,
          as: 'photos'
        }
      ]
    });
    
    if (!unit) {
      return res.status(404).json({ error: 'Unit not found' });
    }
    
    res.json(unit);
  } catch (error) {
    console.error('Error fetching unit:', error);
    res.status(500).json({ error: 'Failed to fetch unit' });
  }
});

app.post('/api/units', async (req, res) => {
  try {
    const unit = await Unit.create(req.body);
    const createdUnit = await Unit.findByPk(unit.id, {
      include: [
        PropertyAddress, 
        Tenant,
        {
          model: Photo,
          as: 'photos'
        }
      ]
    });
    res.status(201).json(createdUnit);
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
    const { name, description } = req.body;
    const accountType = await AccountType.create({ name, description });
    res.status(201).json(accountType);
  } catch (error) {
    console.error('Error creating account type:', error);
    res.status(500).json({ error: 'Failed to create account type' });
  }
});

app.put('/api/account-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    
    const accountType = await AccountType.findByPk(id);
    if (!accountType) {
      return res.status(404).json({ error: 'Account type not found' });
    }
    
    accountType.name = name;
    accountType.description = description;
    await accountType.save();
    
    res.json(accountType);
  } catch (error) {
    console.error('Error updating account type:', error);
    res.status(500).json({ error: 'Failed to update account type' });
  }
});

app.delete('/api/account-types/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const accountType = await AccountType.findByPk(id);
    if (!accountType) {
      return res.status(404).json({ error: 'Account type not found' });
    }
    
    await accountType.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account type:', error);
    res.status(500).json({ error: 'Failed to delete account type' });
  }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const accounts = await Account.findAll({
      include: [AccountType]
    });
    res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const { name, accountTypeId } = req.body;
    const account = await Account.create({ name, accountTypeId });
    res.status(201).json(account);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, accountTypeId } = req.body;
    
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    account.name = name;
    account.accountTypeId = accountTypeId;
    await account.save();
    
    res.json(account);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const account = await Account.findByPk(id);
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    await account.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting account:', error);
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const transactions = await Transaction.findAll({
      include: [
        {
          model: Account,
          include: [AccountType]
        },
        Property
      ]
    });
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { date, description, amount, accountId, propertyId } = req.body;
    const transaction = await Transaction.create({
      date,
      description,
      amount,
      accountId,
      propertyId
    });
    
    const newTransaction = await Transaction.findByPk(transaction.id, {
      include: [
        {
          model: Account,
          include: [AccountType]
        },
        Property
      ]
    });
    
    res.status(201).json(newTransaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, description, amount, accountId, propertyId } = req.body;
    
    const transaction = await Transaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    transaction.date = date;
    transaction.description = description;
    transaction.amount = amount;
    transaction.accountId = accountId;
    transaction.propertyId = propertyId;
    await transaction.save();
    
    const updatedTransaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Account,
          include: [AccountType]
        },
        Property
      ]
    });
    
    res.json(updatedTransaction);
  } catch (error) {
    console.error('Error updating transaction:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const transaction = await Transaction.findByPk(id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    await transaction.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting transaction:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
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

// Maintenance API Endpoints
app.get('/api/maintenance', async (req, res) => {
  try {
    const maintenance = await Maintenance.findAll({
      include: [
        { 
          model: Property,
          required: false // Make this a LEFT JOIN to handle null property_id
        },
        { 
          model: Unit,
          required: false // Make this a LEFT JOIN to handle null unit_id
        }
      ]
    });
    res.json(maintenance);
  } catch (error) {
    console.error('Error fetching maintenance:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance', details: error.message });
  }
});

app.post('/api/maintenance', async (req, res) => {
  try {
    const maintenance = await Maintenance.create(req.body);
    res.status(201).json(maintenance);
  } catch (error) {
    console.error('Error creating maintenance:', error);
    res.status(500).json({ error: 'Failed to create maintenance' });
  }
});

app.put('/api/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Maintenance.update(req.body, { where: { id } });
    const updatedMaintenance = await Maintenance.findByPk(id);
    res.json(updatedMaintenance);
  } catch (error) {
    console.error('Error updating maintenance:', error);
    res.status(500).json({ error: 'Failed to update maintenance' });
  }
});

app.delete('/api/maintenance/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Maintenance.destroy({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting maintenance:', error);
    res.status(500).json({ error: 'Failed to delete maintenance' });
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

// PUT and DELETE endpoints for Units
app.put('/api/units/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { photos, ...unitData } = req.body;
    
    // Update unit
    await Unit.update(unitData, { 
      where: { id },
      transaction: t 
    });
    
    // Handle photos if provided
    if (photos) {
      // Get existing photos
      const existingPhotos = await Photo.findAll({
        where: { unit_id: id },
        transaction: t
      });
      
      const existingPhotoIds = existingPhotos.map(p => p.id);
      const updatedPhotoIds = photos.filter(p => p.id).map(p => p.id);
      
      // Delete photos that are no longer in the updated list
      const photosToDelete = existingPhotoIds.filter(id => !updatedPhotoIds.includes(id));
      if (photosToDelete.length > 0) {
        await Photo.destroy({
          where: {
            id: { [Sequelize.Op.in]: photosToDelete }
          },
          transaction: t
        });
      }
      
      // Update or create photos
      for (const photo of photos) {
        if (photo.id) {
          // Update existing photo
          await Photo.update(
            { 
              name: photo.name,
              is_main: photo.is_main
            },
            { where: { id: photo.id }, transaction: t }
          );
        } else {
          // Create new photo
          await Photo.create(
            {
              unit_id: id,
              name: photo.name,
              url: photo.url,
              is_main: photo.is_main
            },
            { transaction: t }
          );
        }
      }
    }
    
    await t.commit();
    
    // Fetch updated unit
    const updatedUnit = await Unit.findByPk(id, {
      include: [
        PropertyAddress, 
        Tenant,
        {
          model: Photo,
          as: 'photos'
        }
      ]
    });
    
    res.json(updatedUnit);
  } catch (error) {
    await t.rollback();
    console.error('Error updating unit:', error);
    res.status(500).json({ error: 'Failed to update unit' });
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

// Photo API Endpoints
app.get('/api/photos', async (req, res) => {
  try {
    const photos = await Photo.findAll({
      include: [
        { 
          model: Property,
          required: false // Make this a LEFT JOIN to handle null property_id
        },
        { 
          model: Unit,
          required: false // Make this a LEFT JOIN to handle null unit_id
        }
      ]
    });
    res.json(photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

app.post('/api/photos', async (req, res) => {
  try {
    const photo = await Photo.create(req.body);
    res.status(201).json(photo);
  } catch (error) {
    console.error('Error creating photo:', error);
    res.status(500).json({ error: 'Failed to create photo' });
  }
});

app.put('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Photo.update(req.body, { where: { id } });
    const updatedPhoto = await Photo.findByPk(id);
    res.json(updatedPhoto);
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
});

app.delete('/api/photos/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await Photo.destroy({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

// Subscription endpoints
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
const stripe = require('stripe')(stripeSecretKey);

app.get('/api/subscription/plans', async (req, res) => {
  try {
    // Check if we have plans in the database
    let plans = await SubscriptionPlan.findAll();
    
    // If no plans exist, create default plans
    if (plans.length === 0) {
      plans = await SubscriptionPlan.bulkCreate([
        {
          name: 'Basic Plan',
          description: 'Perfect for small property managers with up to 5 properties',
          price: 9.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 5,
            'unit_limit': 10,
            'reports': 'basic',
            'support': 'email'
          })
        },
        {
          name: 'Pro Plan',
          description: 'Ideal for growing property management businesses with up to 20 properties',
          price: 19.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 20,
            'unit_limit': 50,
            'reports': 'advanced',
            'support': 'priority_email'
          })
        },
        {
          name: 'Enterprise Plan',
          description: 'Comprehensive solution for large property management companies',
          price: 49.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 'unlimited',
            'unit_limit': 'unlimited',
            'reports': 'premium',
            'support': '24_7'
          })
        }
      ]);
    }
    
    res.json(plans);
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    res.status(500).json({ error: 'Failed to load subscription plans' });
  }
});

app.post('/api/subscriptions', async (req, res) => {
  try {
    const { userId, planId } = req.body;
    
    // Validate that the plan exists
    const plan = await SubscriptionPlan.findByPk(planId);
    if (!plan) {
      return res.status(404).json({ error: 'Subscription plan not found' });
    }
    
    // Create a new subscription
    const subscription = await Subscription.create({
      user_id: userId || 1, // Default to user 1 if not provided
      plan_id: planId,
      status: 'active',
      start_date: new Date(),
      payment_method: 'credit_card' // Default payment method
    });
    
    res.json(subscription);
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
});

// Get user's current subscription
app.get('/api/subscriptions/current/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const subscription = await Subscription.findOne({
      where: { 
        user_id: userId,
        status: 'active'
      },
      include: [SubscriptionPlan]
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    res.json(subscription);
  } catch (error) {
    console.error('Error fetching current subscription:', error);
    res.status(500).json({ error: 'Failed to fetch current subscription' });
  }
});

// Cancel subscription
app.put('/api/subscriptions/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    const subscription = await Subscription.findByPk(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    subscription.status = 'cancelled';
    subscription.end_date = new Date();
    await subscription.save();
    
    res.json(subscription);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// Portfolio endpoints
app.get('/api/portfolios', async (req, res) => {
  try {
    const portfolios = await Portfolio.findAll();
    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch portfolios' });
  }
});

app.get('/api/portfolios/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const portfolio = await Portfolio.findByPk(id, {
      include: [Property]
    });
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    res.json(portfolio);
  } catch (error) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio' });
  }
});

app.post('/api/portfolios', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { name, description, user_id, property_ids } = req.body;
    
    // Create the portfolio
    const portfolio = await Portfolio.create({
      name,
      description,
      user_id: user_id || 1 // Default to user 1 if not provided
    }, { transaction: t });
    
    // Add properties to the portfolio if provided
    if (property_ids && Array.isArray(property_ids) && property_ids.length > 0) {
      const portfolioProperties = property_ids.map(property_id => ({
        portfolio_id: portfolio.id,
        property_id
      }));
      
      await PortfolioProperty.bulkCreate(portfolioProperties, { transaction: t });
    }
    
    await t.commit();
    
    // Fetch the created portfolio with its properties
    const createdPortfolio = await Portfolio.findByPk(portfolio.id, {
      include: [Property]
    });
    
    res.status(201).json(createdPortfolio);
  } catch (error) {
    await t.rollback();
    console.error('Error creating portfolio:', error);
    res.status(500).json({ error: 'Failed to create portfolio' });
  }
});

app.put('/api/portfolios/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { name, description, property_ids } = req.body;
    
    // Find the portfolio
    const portfolio = await Portfolio.findByPk(id);
    if (!portfolio) {
      await t.rollback();
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Update portfolio details
    if (name) portfolio.name = name;
    if (description !== undefined) portfolio.description = description;
    await portfolio.save({ transaction: t });
    
    // Update portfolio properties if provided
    if (property_ids && Array.isArray(property_ids)) {
      // Remove existing associations
      await PortfolioProperty.destroy({
        where: { portfolio_id: id },
        transaction: t
      });
      
      // Add new associations
      if (property_ids.length > 0) {
        const portfolioProperties = property_ids.map(property_id => ({
          portfolio_id: id,
          property_id
        }));
        
        await PortfolioProperty.bulkCreate(portfolioProperties, { transaction: t });
      }
    }
    
    await t.commit();
    
    // Fetch the updated portfolio with its properties
    const updatedPortfolio = await Portfolio.findByPk(id, {
      include: [Property]
    });
    
    res.json(updatedPortfolio);
  } catch (error) {
    await t.rollback();
    console.error('Error updating portfolio:', error);
    res.status(500).json({ error: 'Failed to update portfolio' });
  }
});

app.delete('/api/portfolios/:id', async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    
    // Delete portfolio properties first
    await PortfolioProperty.destroy({
      where: { portfolio_id: id },
      transaction: t
    });
    
    // Delete the portfolio
    const deleted = await Portfolio.destroy({
      where: { id },
      transaction: t
    });
    
    if (deleted === 0) {
      await t.rollback();
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    await t.commit();
    res.status(204).send();
  } catch (error) {
    await t.rollback();
    console.error('Error deleting portfolio:', error);
    res.status(500).json({ error: 'Failed to delete portfolio' });
  }
});

// Add a property to a portfolio
app.post('/api/portfolios/:portfolioId/properties/:propertyId', async (req, res) => {
  try {
    const { portfolioId, propertyId } = req.params;
    
    // Check if portfolio exists
    const portfolio = await Portfolio.findByPk(portfolioId);
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    // Check if property exists
    const property = await Property.findByPk(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    
    // Check if association already exists
    const existingAssociation = await PortfolioProperty.findOne({
      where: {
        portfolio_id: portfolioId,
        property_id: propertyId
      }
    });
    
    if (existingAssociation) {
      return res.status(409).json({ error: 'Property already in portfolio' });
    }
    
    // Create the association
    await PortfolioProperty.create({
      portfolio_id: portfolioId,
      property_id: propertyId
    });
    
    res.status(201).json({ message: 'Property added to portfolio' });
  } catch (error) {
    console.error('Error adding property to portfolio:', error);
    res.status(500).json({ error: 'Failed to add property to portfolio' });
  }
});

// Remove a property from a portfolio
app.delete('/api/portfolios/:portfolioId/properties/:propertyId', async (req, res) => {
  try {
    const { portfolioId, propertyId } = req.params;
    
    // Delete the association
    const deleted = await PortfolioProperty.destroy({
      where: {
        portfolio_id: portfolioId,
        property_id: propertyId
      }
    });
    
    if (deleted === 0) {
      return res.status(404).json({ error: 'Property not found in portfolio' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing property from portfolio:', error);
    res.status(500).json({ error: 'Failed to remove property from portfolio' });
  }
});

// Get all properties in a portfolio
app.get('/api/portfolios/:id/properties', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the portfolio with its properties
    const portfolio = await Portfolio.findByPk(id, {
      include: [{
        model: Property,
        include: [
          { model: PropertyAddress, as: 'addresses' },
          { model: Photo, as: 'photos' }
        ]
      }]
    });
    
    if (!portfolio) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }
    
    res.json(portfolio.Properties);
  } catch (error) {
    console.error('Error fetching portfolio properties:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio properties' });
  }
});

// Get portfolios for a specific user
app.get('/api/users/:userId/portfolios', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const portfolios = await Portfolio.findAll({
      where: { user_id: userId },
      include: [Property]
    });
    
    res.json(portfolios);
  } catch (error) {
    console.error('Error fetching user portfolios:', error);
    res.status(500).json({ error: 'Failed to fetch user portfolios' });
  }
});

// Database Sync and Seed Function
const syncModels = async () => {
  try {
    console.log('Syncing database models...');
    
    // Force sync in development (drops tables if they exist)
    // In production, you would want to use migrations instead
    await sequelize.sync({ alter: true });
    
    console.log('Database synchronized successfully.');
    
    // Seed data for testing if needed
    const accountTypeCount = await AccountType.count();
    if (accountTypeCount === 0) {
      console.log('Seeding account types...');
      await AccountType.bulkCreate([
        { name: 'Operating', description: 'For day-to-day operations' },
        { name: 'Reserve', description: 'For long-term savings and major repairs' },
        { name: 'Escrow', description: 'For holding funds in trust' }
      ]);
    }
    
    // Seed subscription plans if they don't exist
    const planCount = await SubscriptionPlan.count();
    if (planCount === 0) {
      console.log('Seeding subscription plans...');
      await SubscriptionPlan.bulkCreate([
        {
          name: 'Basic Plan',
          description: 'Perfect for small property managers with up to 5 properties',
          price: 9.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 5,
            'unit_limit': 10,
            'reports': 'basic',
            'support': 'email'
          })
        },
        {
          name: 'Pro Plan',
          description: 'Ideal for growing property management businesses with up to 20 properties',
          price: 19.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 20,
            'unit_limit': 50,
            'reports': 'advanced',
            'support': 'priority_email'
          })
        },
        {
          name: 'Enterprise Plan',
          description: 'Comprehensive solution for large property management companies',
          price: 49.99,
          billing_cycle: 'monthly',
          features: JSON.stringify({
            'property_limit': 'unlimited',
            'unit_limit': 'unlimited',
            'reports': 'premium',
            'support': '24_7'
          })
        }
      ]);
    }
    
  } catch (error) {
    console.error('Database synchronization error:', error);
  }
};

// Initialize database and seed data
syncModels();

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});