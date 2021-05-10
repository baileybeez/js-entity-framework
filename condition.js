//
//
//

const kCondtition_Unknown     = 0
const kCondition_Equality     = 1
const kCondition_Null         = 2
const kCondition_Between      = 3

class Condition {
   constructor(key) {
      this._key = key
      this._type = kCondtition_Unknown
   }

   isNull() {
      this._type = kCondition_Null
      return this
   }

   equals(val) {
      this._type = kCondition_Equality
      this._value = val
   }

   between(r1, r2) {
      this._type = kCondition_Between
      this._start = r1
      this._end = r2
   }

   key() {
      return this._key
   }

   makeWhere () {
      switch (this._type) {
         default: 
         case kCondtition_Unknown:
            return ""

         case kCondition_Equality:
            return ` ${this._key} = @${this._key}`
         case kCondition_Null:
            return ` ${this._key} is null`
         case kCondition_Between:
            return ` ${this._key} between @${this._key}_start and @${this._key}_end`
      }
   }

   setParameters(req, type) {
      switch (this._type) {
         default: 
         case kCondtition_Unknown:
         case kCondition_Null:
            break

         case kCondition_Equality:
            req.addParameter(`${this._key}`, type, this._value)
            break

         case kCondition_Between:
            req.addParameter(`${this._key}_start`, type, this._start)
            req.addParameter(`${this._key}_end`, type, this._end)
            break
      }
   }
}

module.exports = Condition