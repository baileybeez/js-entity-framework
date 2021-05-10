# js-entity-framework

A framework, similar to .NET Entity Framework for interacting with a SQL backend database.

# how does it work?

Entities can be defined programatically and the system will automatically be able to insert, update, select, and delete entries from a corresponding SQL database. 

``` javascript
const DB = require('./entity_framework/dbcontext')
const EF = require('./entity_framework/entity')

class Employee extends EF.Entity {
  constructor() {
    super("Employees")
    super.hasPrimaryKey("Id",     EF.kDataType_BigInt, 	0,  "Id")

    super.hasMember("Email",      EF.kDataType_NVarChar, 	"", "Email")
    super.hasMember("Pin",        EF.kDataType_NVarChar, 	"", "Pin")
    super.hasMember("Name",       EF.kDataType_NVarChar, 	"", "Name")
    super.hasMember("SlackToken", EF.kDataType_NVarChar, 	"", "SlackToken")
    super.hasMember("Deleted",    EF.kDataType_Bit, 		0,  "Deleted")
  }
}

module.exports = Employee
```

``` javascript
const Condition = require('./entity_framework/condition')
const DB = require('./entity_framework/dbcontext')

let cEmail = new Condition("Email")
cEmail.equals(email)

const db = new DB.DbContext({
  server: "example.server.com", 
  user: "user_name", 
  pwd: "password",
  database: "database_to_use"
})

db.select(Employee, [cEmail]).then(set => {
  if (set.length == 0 || set[0].Pin !== pin) {
    issueAuthFailure(res, email)
  }
})
```
