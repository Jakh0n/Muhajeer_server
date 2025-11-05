const userModel = require('../models/user.model')
const bcrypt = require('bcrypt')

class AuthController {
	async login(req, res, next) {
		try {
			const { email, password } = req.body
			const user = await userModel.findOne({ email })
			if (!user) return res.json({ failure: 'User not found' })
			const isValidPassword = await bcrypt.compare(password, user.password)
			if (!isValidPassword)
				return res.json({ failure: 'Password is incorrect' })
			if (user.isDeleted)
				return res.json({
					failure: `User is deleted at ${user.deletedAt.toLocaleString()}`,
				})
			return res.json({ user })
		} catch (error) {
			next(error)
		}
	}
	async register(req, res, next) {
		try {
			const { email, password, fullName } = req.body

			const user = await userModel.findOne({ email })
			if (user) return res.json({ failure: 'User already exists' })

			const hashedPassword = await bcrypt.hash(password, 10)
			const newUser = await userModel.create({
				email,
				password: hashedPassword,
				fullName,
			})

			return res.json({ user: newUser })
		} catch (error) {
			next(error)
		}
	}

	async googleAuth(req, res, next) {
		try {
			console.log('🔵 Google Auth request received:', {
				email: req.body.email,
				hasFullName: !!req.body.fullName,
				hasGoogleId: !!req.body.googleId,
				hasAvatar: !!req.body.avatar,
			})

			let { email, fullName, googleId, avatar } = req.body

			if (!email || !googleId) {
				console.error('❌ Missing required fields:', {
					email: !!email,
					googleId: !!googleId,
				})
				return res.status(400).json({
					failure: 'Email and Google ID are required',
					status: 400,
				})
			}

			// Ensure fullName exists
			if (!fullName || fullName.trim() === '') {
				console.warn('⚠️ FullName is missing, using default')
				fullName = 'User'
			}

			console.log('🔍 Searching for existing user...')
			let user = await userModel.findOne({
				$or: [{ email }, { googleId }],
			})

			if (user) {
				console.log('✅ Found existing user:', user._id)
				// Check if user is deleted
				if (user.isDeleted) {
					console.error('❌ User is deleted')
					return res.status(403).json({
						failure: `User is deleted at ${user.deletedAt.toLocaleString()}`,
						status: 403,
					})
				}

				// Update existing user with Google ID if they don't have it
				if (!user.googleId) {
					console.log('🔄 Updating user with Google ID')
					user.googleId = googleId
					if (avatar && !user.avatar) {
						user.avatar = avatar
					}
					await user.save()
				}
				console.log('✅ Returning existing user')
				return res.json({ user, status: 200 })
			}

			// Create new user with Google OAuth
			console.log('📝 Creating new user with Google OAuth')
			const newUser = await userModel.create({
				email,
				fullName: fullName.trim(),
				googleId,
				avatar: avatar || undefined,
			})

			console.log('✅ New user created:', newUser._id)
			return res.json({ user: newUser, status: 200 })
		} catch (error) {
			console.error('❌ Google auth error:', {
				message: error.message,
				code: error.code,
				name: error.name,
				keyPattern: error.keyPattern,
				keyValue: error.keyValue,
			})
			// Handle duplicate key error
			if (error.code === 11000) {
				console.error('❌ Duplicate key error:', error.keyValue)
				return res.status(409).json({
					failure: 'User with this email or Google ID already exists',
					status: 409,
				})
			}
			// Handle validation errors
			if (error.name === 'ValidationError') {
				console.error('❌ Validation error:', error.errors)
				const validationMessages = Object.values(error.errors)
					.map(e => e.message)
					.join(', ')
				return res.status(400).json({
					failure: 'Validation error: ' + validationMessages,
					status: 400,
				})
			}
			next(error)
		}
	}
}

module.exports = new AuthController()
