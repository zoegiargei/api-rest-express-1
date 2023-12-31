import encryptedJWT from '../../utils/jwt/encrypted.jwt.js'

export async function handlerPostAuth (req, res, next) {
    try {
        const payload = req.user
        delete payload.documents
        delete payload.orders

        const ttl = '2h'
        const token = encryptedJWT.encryptData(payload, ttl)
        res.cookie('jwt_authorization', token, {
            signed: true,
            httpOnly: true
        })

        res.sendAccepted({ message: 'User successfully logged in', object: req.user })
    } catch (error) {
        next(error)
    }
}

export async function handlerPostLogout (req, res, next) {
    try {
        res.clearCookie('jwt_authorization', {
            signed: true,
            httpOnly: true
        })
        res.sendOk({ message: 'Successfully Logout', object: req.user })
    } catch (error) {
        next(error)
    }
}
