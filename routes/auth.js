const authController = require('../controllers/auth.controller')

const router = require('express').Router()

router.post('/login', authController.login)
router.post('/register', authController.register)
router.post('/google', authController.googleAuth)

module.exports = router
