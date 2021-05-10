// Js Entity Framework
//	Entity
// 
// baileybeez

const MSSQL = require("tedious")

// TODO: switch to use the MSSQL.TYPES instead of custom 
// 	(to remove the need to map them to those types later)
const kDataType_Invalid 	= 0
const kDataType_BigInt 		= 1
const kDataType_Int 			= 2
const kDataType_Bit 			= 3
const kDataType_NVarChar	= 4
const kDataType_DateTime   = 5

const kTableName		= "_table_"
const kFieldMap		= "_fieldMap_"
const kPrimary			= "_primary_"

class Entity {
	constructor(tableName) {
		this.defineTable(tableName)
	}

	_prop(name, value, visible = true, readonly = false) {
		Object.defineProperty(this, name, {
			value: value,
			enumerable: visible,
			configurable: false, 
			writable: !readonly
		})
	}

	_addFieldData(field, type, defValue, colName, isPrimary = false) {
		this[kFieldMap].push({
			fieldName: field,
			defaultValue: defValue,
			dbType: type,
			dbColumn: colName,
			isPrimary: isPrimary
		})
	}

	defineTable(name) {
		this._prop(kTableName, name, false, true)
		this._prop(kFieldMap, [], false, false)
		this._prop(kPrimary, null, false, false)
	}

	hasPrimaryKey(field, type, defValue, colName = undefined) {
		if (this.hasField(field)) {
			console.log(`error: Entity already contains field '${field}'`)
			return
		}

		if (this[kPrimary] != null) {
			console.log(`error: Entity already contains primary key`)
			return
		}

		this._prop(field, defValue)
		this._addFieldData(field, type, defValue, colName || field, true)
		this[kPrimary] = field
	}

	hasMember(field, type, defValue, colName = undefined) {
		if (this.hasField(field)) {
			console.log(`error: Entity already contains field '${field}'`)
			return
		}

		this._prop(field, defValue)
		this._addFieldData(field, type, defValue, colName || field, false)
	}

	hasField(field) {
		return this[kFieldMap].filter(f => f.name == field).length > 0
	}

   prep() {
      // 
   }

	tableName() {
		return this[kTableName]
	}

	fieldMap() {
		var set = []
		this[kFieldMap].forEach(item => {
			set.push({
				fieldName: item.fieldName,
				defaultValue: item.defaultValue,
				dbType: item.dbType,
				dbColumn: item.dbColumn,
				isPrimary: item.isPrimary
			})
		})
		return set
	}
}

module.exports = { 
	Entity, 
	kDataType_Invalid, kDataType_BigInt, kDataType_Int, kDataType_Bit, kDataType_NVarChar, kDataType_DateTime
}