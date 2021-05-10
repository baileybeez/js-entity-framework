// Js Entity Framework
// DbContext
//
// baileybeez

const MSSQL = require("tedious")
const EF = require("./entity")

class DbContext {
	constructor(options) {
		this.config = this.createConfigFrom(options)
		this._objectMap = []
	}

	createConfigFrom(opts) {
		return {
			server: opts.server,
			authentication: {
				type: "default",
				options: {
					userName: opts.user,
					password: opts.pwd
				}
			}, 
			options: {
				database: opts.database,
				trustServerCertificate: true
			}
		}	
	}

	registerClass(cls, tbl) {
		var T = new cls()

		this._objectMap.push({ 
			name: cls.name,
			object: cls, 
			tableName: T.tableName(), 
			fieldMap: T.fieldMap()
		})
	}

   select(cls, conditions = []) {
      return new Promise((resolve, reject) => {
			const conn = new MSSQL.Connection(this.config)
			const proto = this._findObjectMeta(cls.name)
			if (proto == null) {
				reject(`error: requested object '${cls.name}' not registered.`)
				return
			}

			let prmType = EF.kDataType_Invalid
			let cmd = `select * from ${proto.tableName}`
         if (conditions.length > 0)
            cmd = cmd.concat(" where")

         conditions.forEach((cond, idx) => {
            prmType = this._getDbType(cond.key(), proto)
            if (prmType == null) {
					reject(`error: unable to map type for '${cond.key}' `)
               return
				}

            cmd = cmd.concat(` ${idx > 0 ? 'and' : ''} ${cond.makeWhere()}`)
         })

			this._createCommand(cmd).then(req => {
            conditions.forEach((cond, idx) => {
               prmType = this._getDbType(cond.key(), proto)
               if (prmType == null) {
                  reject(`error: unable to map type for '${cond.key}' `)
                  return
               }

               cond.setParameters(req, prmType)
            })
				
				this._fillTable(conn, req, cls, resolve, reject)
			}).catch (err => { reject(err) })
		})
   }

	save(obj, cls) {
		return new Promise((resolve, reject) => {
			const proto = this._findObjectMeta(cls.name)
			if (proto == null) {
				reject(`error: requested object '${cls.name}' not registered.`)
				return
			}

			const set = proto.fieldMap.filter(f => f.isPrimary)
			if (set.length == 0) {
				reject(`error: requested object '${cls.name}' does not have a primary key defined.`)
				return
			}

			const val = obj[set[0].fieldName]
			if (val == set[0].defaultValue) {
				this.createObject(obj, cls).then(ret => {
					resolve(ret)
				}).catch(err => { reject(err) })
			} else {
				this.updateObject(obj, cls).then(ret => {
					resolve(ret)
				}).catch(err => { reject(err) })
			}
		})
	}

	createObject(obj, cls) {
		return new Promise((resolve, reject) => {
			const conn = new MSSQL.Connection(this.config)
			var proto = this._findObjectMeta(cls.name)
			if (proto == null) {
				reject(`error: requested object '${cls.name}' not registered.`)
				return
			}

			var fields = []
			var key = null
			proto.fieldMap.forEach(f => {
				if (f.isPrimary) {
					key = f 
				} else {
					fields.push(f.dbColumn)
				}
			})

			let cmd = `insert into ${proto.tableName} (${fields.join(',')}) `
			if (key != null) {
				cmd = cmd.concat(` OUTPUT INSERTED.${key.dbColumn} `)
			}
			cmd = cmd.concat(` values (${fields.map(a => `@${a}`).join(',')})`)

			this._createCommand(cmd).then(req => {
				proto.fieldMap.forEach(f => {
					if (!f.isPrimary) {
						req.addParameter(f.dbColumn, this._translateDbType(f.dbType), obj[f.fieldName])
					}
				})

				this._insertSql(conn, req).then(prim => {
					obj[key.fieldName] = prim
					resolve(obj)
				}).catch (err => { reject(err) })
			}).catch (err => { reject(err) })
		})
	}

	updateObject(obj, cls) {
		return new Promise((resolve, reject) => {
			const conn = new MSSQL.Connection(this.config)
			var proto = this._findObjectMeta(cls.name)
			if (proto == null) {
				reject(`error: requested object '${cls.name}' not registered.`)
				return
			}

			var info = this._gatherFieldInfo(proto)
			if (info.primaryKey == null) {
				reject(`error: requested object '${cls.name}' does not have a primary key defined`)
				return
			}

			let cmd = `update ${proto.tableName} set `
			info.fields.forEach((f, i) => {
				cmd = cmd.concat(` ${f} = @${f} ${i < info.fields.length - 1 ? ',' : ''}`)
			})
			cmd = cmd.concat(` where ${info.primaryKey} = @${info.primaryKey}`)

			this._createCommand(cmd).then(req => {
				proto.fieldMap.forEach(f => {
					req.addParameter(f.dbColumn, this._translateDbType(f.dbType), obj[f.fieldName])
				})

				this._updateSql(conn, req).then(res => {
					resolve(obj)
				}).catch (err => { reject(err) })
			})
		})
	}

   testConnection() {
      return new Promise((resolve, reject) => {
         const conn = new MSSQL.Connection(this.config)
         conn.connect(err => {
            if (err) {
               console.log(err)
               reject(err)
            } else {
               resolve(true)
            }
         })
      })
   }

	_gatherFieldInfo(proto) {
		var ret = { 
			primaryKey: null,
			fields: []
		}

		proto.fieldMap.forEach(f => {
			if (f.isPrimary) {
				ret.primaryKey = f.dbColumn 
			} else {
				ret.fields.push(f.dbColumn)
			}
		})

		return ret
	}

	_translateDbType(efType) {
		switch (efType) {
			default: 								return MSSQL.TYPES.Null
		
			case EF.kDataType_BigInt: 			return MSSQL.TYPES.BigInt
			case EF.kDataType_Int: 				return MSSQL.TYPES.Int
			case EF.kDataType_Bit: 				return MSSQL.TYPES.Bit
			case EF.kDataType_NVarChar:		return MSSQL.TYPES.NVarChar
         case EF.kDataType_DateTime:      return MSSQL.TYPES.DateTime
		}
	}

	_getDbType(key, proto) {
		var set = proto.fieldMap.filter(f => f.dbColumn == key)
		if (set.length == 0)
			return null

		return this._translateDbType(set[0].dbType)
	}

	_findObjectMeta(name) {
		var meta = this._objectMap.filter(o => o.name == name)
		if (meta.length == 0)
			return null

		return meta[0]
	}

	_createCommand(cmd) {
		return new Promise((resolve, reject) => { 
			let req = new MSSQL.Request(cmd, err => { if (err) reject(err) })

			resolve(req)
		})
	}

	_fillTable(conn, req, cls, resolve, reject) {
		conn.on("connect", err => {
			if (err) {
				reject(err)
				return
			}

			let set = []
			
			req.on("row", cols => {
				let row = new cls()
				cols.forEach(col => {
					row[col.metadata.colName] = col.value
				})
            row.prep()
				set.push(row)
			})
			req.on("requestCompleted", () => {
				resolve(set)
			})
         req.on("error", err => {
            reject(err)
         })

			conn.execSql(req)
		})
		conn.connect()
	}

	_insertSql(conn, req) {
		return new Promise((resolve, reject) => {
			conn.on("connect", err => {
				if (err) {
					reject(err)
					return
				}

				let prim = null
				req.on("row", cols => {
					cols.forEach(col => {
						if (col != null) {
							prim = col.value
						}
					})
				})
				req.on("requestCompleted", () => {
					resolve(prim)
				})
            req.on("error", err => {
               reject(err)
            })

				conn.execSql(req)
			})
			conn.connect()		
		})
	}

	_updateSql(conn, req) {
		return new Promise((resolve, reject) => {
			conn.on("connect", err => {
				if (err) {
					reject(err)
					return
				}

				let prim = null
				req.on("row", cols => {
					cols.forEach(col => {
						console.log(col)
					})
				})
				req.on("requestCompleted", () => {
					resolve(prim)
				})
            req.on("error", err => {
               reject(err)
            })

				conn.execSql(req)
			})
			conn.connect()
		})
	}
}

module.exports = { DbContext }
