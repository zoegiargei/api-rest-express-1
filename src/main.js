import express from 'express'
import { errorHandler } from './middlewares/errorHandler.js'
import apiRouter from './routers/api/api.router.js'
import cookieParser from 'cookie-parser'
import { SECRET_WORD } from './configs/cookie.config.js'
import { passportInitialize } from './middlewares/passport/passport.strategies.js'
import cors from 'cors'
import { customResponses } from './lib/custom.responses.js'
import { PORT } from './configs/server.config.js'
import { MONGO_CNX_STR } from './configs/mongo.config.js'
import { logger } from './middlewares/logger/logger.js'
import compression from 'express-compression'
import { createServer } from 'http'
import swaggerUi from 'swagger-ui-express'
import webRouter from './routers/web/web.router.js'
import { engine } from 'express-handlebars'
import swaggerSpecs from './options/swagger.options.js'
import corsOptions from './options/cors.options.js'
// import cluster from 'cluster'
// import { cpus } from 'node:os'
// cluster.schedulingPolicy = cluster.SCHED_RR

const app = express()

if (process.env.PERSISTENCE === 'MONGO') {
    async function connectMongoose () {
        try {
            const mongoose = await import('mongoose')
            await mongoose.connect(MONGO_CNX_STR)
        } catch (error) {
            console.log(error)
            throw new Error(error)
        }
    }
    await connectMongoose()
}

app.use(logger)
app.use(cookieParser(SECRET_WORD))
app.use(passportInitialize)
app.use(cors(corsOptions))
app.use(customResponses)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(compression({ brotli: { enabled: true, zlib: {} } }))
app.use(express.static('./public'))
app.engine('handlebars', engine())
app.set('views', './views')
app.set('view engine', 'handlebars')
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs))
app.use('/api', apiRouter)
app.use('/web', webRouter)
app.use(errorHandler)

app.get('*', (req, res) => {
    if ((/^[/](web)[/][a-z]*$/i).test(req.url)) {
        res.json({ message: 'Similar route' })
    }
    res.json({ message: `Unknown route: ${req.url}` })
})

/* if (cluster.isPrimary) {
    let numWorkers = cpus().length
    for (let i = 0; i < numWorkers; i++) { cluster.fork() }
    cluster.on('exit', worker => {
        numWorkers--
        cluster.fork()
    })
} else if (cluster.isWorker) {
    const server = createServer(app)
    server.listen(PORT, '0.0.0.0', () => { winstonLogger.fatal(`Server running on port: ${PORT}`) })

    if (config.PERSISTENCE === 'MONGO') {
        const mongoose = await import('mongoose')
        await mongoose.connect(MONGO_CNX_STR, { useNewUrlParser: true, useUnifiedTopology: true })
    }

    cluster.on('error', (err) => {
        winstonLogger.fatal(err)
    })
} */

const server = createServer(app)
server.listen(PORT, '0.0.0.0', () => { console.log(`Server running on port: ${PORT}`) })
