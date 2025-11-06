const nodemailer = require('nodemailer')
const bcrypt = require('bcrypt')
const otpModel = require('../models/otp.model')
const otpTemplate = require('../template/otp.template')
const succesTemplate = require('../template/succes.template')
const cancelTemplate = require('../template/cancel.template')
const updateTemplate = require('../template/update.template')

class MailService {
	constructor() {
		// Only create transporter if SMTP is configured
		if (
			process.env.SMTP_HOST &&
			process.env.SMTP_USER &&
			process.env.SMTP_PASSWORD
		) {
			const port = parseInt(process.env.SMTP_PORT) || 587
			const secure = port === 465

			console.log('📧 Initializing SMTP transporter:', {
				host: process.env.SMTP_HOST,
				port: port,
				secure: secure,
				user: process.env.SMTP_USER,
			})

			this.transporter = nodemailer.createTransport({
				host: process.env.SMTP_HOST,
				port: port,
				secure: secure,
				requireTLS: !secure && port === 587, // Require TLS for port 587
				auth: {
					user: process.env.SMTP_USER,
					pass: process.env.SMTP_PASSWORD,
				},
				connectionTimeout: 10000, // 10 seconds
				greetingTimeout: 10000,
				socketTimeout: 10000,
				debug: process.env.NODE_ENV === 'development', // Enable debug in dev
				logger: false, // Disable verbose logging in production
			})
		} else {
			this.transporter = null
			console.warn(
				'⚠️  SMTP is not configured. Email functionality will be disabled.'
			)
		}
	}

	async sendOtpMail(email) {
		// Check if SMTP is configured
		if (!this.transporter) {
			throw new Error(
				'SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.'
			)
		}

		const otp = Math.floor(100000 + Math.random() * 900000) // 6 digit OTP
		console.log('📧 Sending OTP:', otp, 'to:', email)

		const hashedOtp = await bcrypt.hash(otp.toString(), 10)
		await otpModel.deleteMany({ email })
		await otpModel.create({
			email,
			otp: hashedOtp,
			expireAt: Date.now() + 5 * 60 * 1000,
		}) // 5 minutes

		try {
			console.log('📤 Attempting to send email via SMTP...')
			const startTime = Date.now()

			await this.transporter.sendMail({
				from: process.env.SMTP_USER,
				to: email,
				subject: `OTP for verification ${new Date().toLocaleString()}`,
				html: otpTemplate(otp),
			})

			const duration = Date.now() - startTime
			console.log(`✅ Email sent successfully in ${duration}ms`)
		} catch (error) {
			console.error('❌ Failed to send OTP email:', {
				message: error.message,
				code: error.code,
				command: error.command,
				response: error.response,
			})
			throw new Error(`Failed to send OTP email: ${error.message}`)
		}
	}

	async sendSuccessMail({ user, product }) {
		if (!this.transporter) {
			console.warn('SMTP not configured, skipping success email')
			return
		}
		await this.transporter.sendMail({
			from: process.env.SMTP_USER,
			to: user.email,
			subject: `Order Confirmation ${new Date().toLocaleString()}`,
			html: succesTemplate({ user, product }),
		})
	}

	async sendCancelMail({ user, product }) {
		if (!this.transporter) {
			console.warn('SMTP not configured, skipping cancel email')
			return
		}
		await this.transporter.sendMail({
			from: process.env.SMTP_USER,
			to: user.email,
			subject: `Order Cancelled ${new Date().toLocaleString()}`,
			html: cancelTemplate({ user, product }),
		})
	}

	async sendUpdateMail({ user, product, status }) {
		if (!this.transporter) {
			console.warn('SMTP not configured, skipping update email')
			return
		}
		await this.transporter.sendMail({
			from: process.env.SMTP_USER,
			to: user.email,
			subject: `Order Update ${new Date().toLocaleString()}`,
			html: updateTemplate({ user, product, status }),
		})
	}

	async verifyOtp(email, otp) {
		const record = await otpModel.find({ email })
		if (!record) return { failure: 'Record not found' }
		const lastRecord = record[record.length - 1]
		if (!lastRecord) return { failure: 'Record not found' }
		if (lastRecord.expireAt < new Date()) return { status: 301 }

		const isValid = await bcrypt.compare(otp, lastRecord.otp)
		if (!isValid) return { failure: 'Invalid OTP' }

		await otpModel.deleteMany({ email })
		return { status: 200 }
	}
}

module.exports = new MailService()
