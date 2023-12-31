import errors from '../lib/customErrors.js'
import { User } from '../models/User/User.js'
import { userRepository } from '../DAO/repositories/user.repository.js'
import userDaoMongo from '../DAO/mongo/user.dao.mongo.js'
import encryptedPass from '../utils/password/encrypted.pass.js'
import cartServices from './cart.services.js'
import userDaoMemory from '../DAO/memory/user.dao.memory.js'
import Document from '../models/Document.js'
import tokenServices from './token.services.js'
import templatesForEmails from '../utils/templates/templates.send.email.js'
import emailService from './email.services.js'
import { winstonLogger } from '../middlewares/logger/logger.js'
import { v4 as uuidv4 } from 'uuid'
import { PORT } from '../configs/server.config.js'

class UserServices {
    constructor (repository, dao) {
        this.userRepository = repository
        this.userDao = dao
    }

    async saveUser (data) {
        await cartServices.createCart(data.email)
        const cid = await cartServices.getLastOne()

        const userData = { ...data, cart: cid }
        if (process.env.NODE_ENV === 'dev') userData._id = String(uuidv4())
        const newUser = new User(userData)
        const userAsDto = newUser.toDto()
        if (userAsDto._id === null) {
            delete userAsDto._id
        }
        const response = this.userRepository.saveDtoInDB(userAsDto)
        return response
    }

    async getUserById (id) {
        const user = await this.userDao.findElementById(id)
        if (user === {} || user === undefined || user === null) throw errors.not_found.withDetails('User not found')
        return user
    }

    async getUserByEmail (userEmail, selectOptions = null) {
        if (selectOptions !== null) {
            return await this.userDao.findOneByQuery({ email: userEmail }, selectOptions)
        }
        return await this.userDao.findOneByQuery({ email: userEmail })
    }

    async getUserByQuery (query) {
        return await this.userDao.findElementsByQuery(query)
    }

    async getUsers () {
        return await this.userDao.findElements()
    }

    async getUsersByProjection (param1, param2) {
        if (typeof param1 !== 'object' || typeof param2 !== 'object') throw errors.invalid_input_format.withDetails('The data type of the projection search parameters must be "Object"')
        return await this.userDao.findElementByProjection(param1, param2)
    }

    async updateUser (id, newValues) {
        return await this.userDao.updateElement(id, newValues)
    }

    async addUserDocuments (files, uid) {
        const docNames = Object.keys(files)
        const userDocuments = await this.getUsersByProjection({ _id: uid }, { projection: { documents: 1 } })
        userDocuments.splice(0, 1)
        docNames.forEach(fieldName => {
            const newDocument = new Document(fieldName, files[fieldName][0].filename, uid)
            const existingIndex = userDocuments?.findIndex(doc => doc.typeDoc === newDocument.typeDoc)
            if (existingIndex >= 0) {
                userDocuments.splice(existingIndex, 1, newDocument)
            } else {
                if (userDocuments.length) {
                    userDocuments.push(newDocument)
                } else {
                    userDocuments.push(newDocument)
                }
            }
        })
        return await this.userDao.updateFieldElement(uid, { $set: { documents: userDocuments } })
    }

    async convertToPremium (uid, DocumentTypes) {
        const user = await this.getUserById(uid)
        const userDocuments = user.documents
        const hasAllDocuments = Object.values(DocumentTypes).every(type => {
            return userDocuments.some(doc => doc.typeDoc === type)
        })
        const canBePremium = hasAllDocuments

        let result
        if (user.role !== 'Premium') {
            if (canBePremium) {
                user.role = 'Premium'
                result = await userServices.updateUser(uid, user)
            } else {
                throw errors.invalid_permission.withDetails('The user must have all required documents')
            }
        } else {
            throw errors.conflict.withDetails('The user is already Premium')
        }

        return result
    }

    async addProfileImage (uid, image) {
        const user = await this.getUserById(uid)
        if (image) {
            const profileImage = new Document('profileImage', image.filename, uid)
            const existingIndex = user.documents.findIndex(doc => doc.typeDoc === profileImage.typeDoc)
            if (existingIndex >= 0) {
                user.documents.splice(existingIndex, 1, profileImage)
            } else {
                user.documents.push(profileImage)
            }
        }
        return this.updateUser(uid, user)
    }

    async sendEmailToUpdatePass (uid, web) {
        const user = await this.getUserById(uid)
        const token = await tokenServices.createToken(uid)
        const tokenToUrl = token.token
        await tokenServices.saveTockenUpdatePass(user._id, token)
        let url
        const domain = process.env.DOMAIN || `http://localhost:${PORT}/`
        if (web) {
            url = `${domain}web/users/updatePassword?token=${tokenToUrl}`
        } else {
            url = `${domain}api/users/updatePassword?token=${tokenToUrl}`
        }
        const message = templatesForEmails.templateEmailResetPass(url, user.username)
        const userEmail = user.email
        await emailService.send(userEmail, message, 'Do you want to reset your password?')
        return userEmail
    }

    async updatePassword (id, currentPass, newPass) {
        const user = await this.getUserById(id)

        const isValidCurrentPassword = encryptedPass.isValidPassword(user.password, currentPass)
        if (isValidCurrentPassword === false) throw errors.authentication_failed.withDetails('The current password is wrong')

        const isValidNewPassword = encryptedPass.isValidPassword(user.password, newPass)
        if (isValidNewPassword) throw errors.invalid_input.withDetails('The new password cannot be equal to the current password')

        const rehydratedUser = new User(user)
        rehydratedUser.password = newPass
        const userDto = rehydratedUser.toDto()
        const response = this.userDao.updateElement(id, userDto)
        return response
    }

    async updateLastConnection (uid) {
        const newTime = { lastConnection: { date: new Date().toLocaleDateString(), hour: new Date().toLocaleTimeString() } }
        const response = this.userDao.updateElement(uid, newTime)
        return response
    }

    async deleteUsersByQuery (query) {
        if (typeof query !== 'object') throw errors.invalid_input_format.withDetails('The data type of the method parameter must be "Object"')
        return await this.userDao.deleteManyElemByQuery(query)
    }

    async deleteOldUsers () {
        const date = new Date()
        date.setDate(date.getDate() - 2)
        const dateQuery = date.toLocaleDateString()

        const expiredUsers = await this.getUsersByProjection({ 'lastConnection.date': { $lt: dateQuery } }, { email: 1, cart: 1, lastConnection: 1 })
        const emails = expiredUsers.map(user => user.email)
        const carts = expiredUsers.map(user => user.cart[0]._id)

        let result
        if (emails.length > 0) {
            emails.forEach(async em => {
                const message = templatesForEmails.templateSendExpiredAccount()

                let userEmail
                if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'test') {
                    userEmail = process.env.HARDCODED_EMAIL
                } else {
                    userEmail = em
                }
                await emailService.send(userEmail, message, 'Your account was expired')
                result = await this.deleteUsersByQuery({ email: em })
            })
            carts.forEach(async cid => {
                const deletedCarts = await cartServices.deleteCart(cid)
                winstonLogger.warn(deletedCarts)
            })
        }

        return { result, expiredUsers }
    }

    async deleteUser (uid) {
        const user = await this.getUserById(uid)
        console.log(user)
        const cid = user.cart[0]._id
        await cartServices.deleteCart(cid)
        return await this.userDao.deleteElement(uid)
    }
}
let userServices
if (process.env.NODE_ENV === 'dev') {
    userServices = new UserServices(userRepository, userDaoMemory)
} else {
    userServices = new UserServices(userRepository, userDaoMongo)
}
export default userServices
