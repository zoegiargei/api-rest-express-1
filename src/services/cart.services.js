import cartDaoMemory from '../DAO/memory/cart.dao.memory.js'
import cartDaoMongo from '../DAO/mongo/cart.dao.mongo.js'
import errors from '../lib/customErrors.js'
import Cart from '../models/Cart/Cart.js'
import Order from '../models/Order.js'
import Ticket from '../models/Ticket.js'
import templatesForEmails from '../utils/templates/templates.send.email.js'
import emailService from './email.services.js'
import productServices from './product.services.js'
import ticketServices from './ticket.services.js'
import userServices from './user.services.js'

class CartServices {
    constructor (cartDao) {
        this.cartDao = cartDao
    }

    async validateCartId (cid) {
        const cartInDb = await this.cartDao.findElementById(cid)
        if (!cartInDb) throw errors.invalid_input.withDetails('Invalid cart id')
        return cartInDb
    }

    async validateProductId (pid) {
        const productById = await productServices.getProductById(pid)
        if (!productById) throw errors.invalid_input.withDetails('Invalid product id')
        return productById
    }

    async createCart (userEmail) {
        const newCart = new Cart(userEmail)
        const cartDto = newCart.toDto()
        const cart = await this.cartDao.createElement(cartDto)
        return cart
    }

    async getLastOne () {
        const lastOne = await this.cartDao.findTheLastOne()
        return lastOne
    }

    async getCartById (cid) {
        return await this.cartDao.findElementById(cid)
    }

    async getCartByQuery (query) {
        if (typeof query !== 'object') throw errors.invalid_input_format.withDetails('Query must be an object')
        return await this.cartDao.findElementsByQuery(query)
    }

    async getCartByIdAndQuery (cid, query) {
        return await this.cartDao.findElementByIdAndQuery(cid, query)
    }

    async addToCart (cid, pid, quantity = 1, userEmail) {
        const cartInDb = await this.validateCartId(cid)
        const productsCart = cartInDb.productsCart
        const owner = await productServices.getProductsByProjection({ _id: pid }, { owner: 1 })
        if (productsCart) {
            const index = productsCart.findIndex(prod => String(prod.product._id) === pid)
            if (index !== -1) {
                productsCart[index].quantity += Number(quantity)
            } else {
                if (owner[0].owner !== userEmail) {
                    productsCart.push({ product: pid, quantity })
                } else {
                    throw errors.permission_failes.withDetails('You can not buy your own products')
                }
            }
            const result = await this.updateProductsCart(cid, productsCart)
            return result
        } else {
            throw errors.not_found.withDetails('There is not a product cart with this cart ID')
        }
    }

    async updateProductsCart (cid, data) {
        const cartInDb = await this.validateCartId(cid)
        if (!data || data === []) throw errors.invalid_input.withDetails('You sent an invalid data for update the cart')
        cartInDb.productsCart = data
        const result = await this.cartDao.updateElement(cid, cartInDb)
        return result
    }

    async updateProdInCart (cid, pid, newQuantity) {
        const cartInDb = await this.validateCartId(cid)
        const productsCart = cartInDb.productsCart
        const index = productsCart.findIndex(prod => String(prod.product._id) === pid)
        if (index !== -1) {
            productsCart[index].quantity = newQuantity
            await this.cartDao.updateElement(cid, cartInDb)
            return cartInDb
        } else {
            throw errors.not_found.withDetails('Product not found in cart')
        }
    }

    async delProdInCart (cid, pid) {
        const cartInDb = await this.validateCartId(cid)
        const productsCart = cartInDb.productsCart

        const index = productsCart.findIndex(prod => String(prod.product._id) === pid)
        if (index !== -1) {
            const newCartInDb = productsCart.filter(prod => String(prod.product._id) !== pid)
            console.log(newCartInDb)
            cartInDb.productsCart = newCartInDb
            await this.cartDao.updateElement(cid, cartInDb)
            return cartInDb
        } else {
            throw errors.not_found.withDetails('Product not found in cart')
        }
    }

    async deleteAllProducts (cid) {
        const cartInDb = await this.validateCartId(cid)
        cartInDb.productsCart = []
        return await this.updateProductsCart(cid, cartInDb)
    }

    async deleteCart (cid) {
        return await this.cartDao.deleteElement(cid)
    }

    async purchaseFirstStep (user) {
        const cid = user.cart[0]._id
        const cart = await this.getCartById(cid)
        const productsCart = cart.productsCart
        const purchaseData = []
        let totalPurchase = 0
        const newProductsCart = []

        for (const obj of productsCart) {
            if (obj.product) {
                const product = await productServices.getProductById(String(obj.product._id))
                const quantity = obj.quantity

                if (product.stock >= quantity) {
                    product.stock = product.stock - quantity
                    const price = product.price * quantity
                    totalPurchase = totalPurchase + Number(price)
                    delete productsCart.obj
                    purchaseData.push({ _id: product._id, quantity, totalAmount: price })
                    await productServices.updateProduct(product._id, product)
                    await this.updateProductsCart(cid, productsCart)
                } else {
                    newProductsCart.push(obj)
                }
            }
        }

        await this.updateProductsCart(cid, newProductsCart)
        return { totalPurchase, purchaseData }
    }

    async purchaseSecondStep (totalPurchase, user, purchaseData) {
        const ticket = new Ticket(totalPurchase, user.email)
        await ticketServices.saveTicket(ticket)
        const ticketInDb = await ticketServices.getLastCreatedTicket()
        const newOrder = new Order(purchaseData, ticketInDb)
        user.orders.push(newOrder)
        await userServices.updateUser(user._id, user)
        const message = templatesForEmails.templateSendTicket(ticket)

        let purchaser
        if (process.env.NODE_ENV === 'dev' || process.env.NODE_ENV === 'test') {
            purchaser = process.env.HARDCODED_EMAIL
        } else {
            purchaser = user.email
        }
        await emailService.send(purchaser, message, 'Purchase ticket')
        return ticket
    }
}
let cartServices
if (process.env.NODE_ENV === 'dev') {
    cartServices = new CartServices(cartDaoMemory)
} else {
    cartServices = new CartServices(cartDaoMongo)
}
export default cartServices
