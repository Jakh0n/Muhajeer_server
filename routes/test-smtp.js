const express = require('express')
const router = express.Router()
const mailService = require('../services/mail.service')

// Test SMTP configuration
router.get('/test', async (req, res) => {
	try {
		const hasConfig =
			process.env.SMTP_HOST &&
			process.env.SMTP_USER &&
			process.env.SMTP_PASSWORD

		if (!hasConfig) {
			return res.status(500).json({
				success: false,
				message: 'SMTP configuration is missing',
				env: {
					hasHost: !!process.env.SMTP_HOST,
					hasUser: !!process.env.SMTP_USER,
					hasPassword: !!process.env.SMTP_PASSWORD,
					port: process.env.SMTP_PORT || 'not set',
				},
			})
		}

		if (!mailService.transporter) {
			return res.status(500).json({
				success: false,
				message: 'SMTP transporter not initialized',
			})
		}

		// Test connection with timeout
		const verifyPromise = new Promise((resolve, reject) => {
			mailService.transporter.verify((error, success) => {
				if (error) {
					reject(error)
				} else {
					resolve(success)
				}
			})
		})

		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => {
				reject(new Error('SMTP verification timeout after 10 seconds'))
			}, 10000)
		})

		await Promise.race([verifyPromise, timeoutPromise])

		res.json({
			success: true,
			message: 'SMTP connection verified successfully',
			config: {
				host: process.env.SMTP_HOST,
				port: process.env.SMTP_PORT || 587,
				user: process.env.SMTP_USER,
			},
		})
	} catch (error) {
		res.status(500).json({
			success: false,
			message: 'SMTP verification failed',
			error: error.message,
		})
	}
})

module.exports = router
