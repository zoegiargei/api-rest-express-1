import { buildCheckFunction } from 'express-validator'
import { validateResult } from './validation.result.js'

const check = buildCheckFunction(['query'])

const validateQueryCategory = [
    check('category').optional().not().isEmpty().trim().escape(),
    (req, res, next) => {
        validateResult(req, res, next, 400)
    }
]

const validateQueryPage = [
    check('page').optional().not().isEmpty().trim().escape().isNumeric(),
    (req, res, next) => {
        validateResult(req, res, next, 400)
    }
]

export {
    validateQueryCategory,
    validateQueryPage
}
