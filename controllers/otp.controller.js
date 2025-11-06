const mailService = require('../services/mail.service')

class OtpController {
	async sendOtp(req, res, next) {
		const startTime = Date.now()
		try {
			const { email } = req.body
			console.log('📧 OTP request received:', {
				email,
				timestamp: new Date().toISOString(),
			})

			if (!email) {
				console.warn('⚠️  OTP request missing email')
				return res.status(400).json({ failure: 'Email is required' })
			}

			// Create a timeout promise with AbortController-like behavior
			let timeoutId
			const timeoutPromise = new Promise((_, reject) => {
				timeoutId = setTimeout(() => {
					reject(
						new Error(
							'Request timeout after 15 seconds. SMTP server may be slow or unreachable.'
						)
					)
				}, 15000) // 15 second timeout
			})

			// Race between email send and timeout
			try {
				console.log('⏳ Starting OTP email send...')
				await Promise.race([mailService.sendOtpMail(email), timeoutPromise])
				clearTimeout(timeoutId)
				const duration = Date.now() - startTime
				console.log(`✅ OTP sent successfully in ${duration}ms`)
			} catch (error) {
				clearTimeout(timeoutId)
				const duration = Date.now() - startTime
				console.error(`❌ OTP send failed after ${duration}ms:`, error.message)
				throw error
			}

			res.json({ status: 200 })
		} catch (error) {
			const duration = Date.now() - startTime
			console.error('❌ OTP send error after', duration, 'ms:', {
				message: error.message,
				stack: error.stack,
			})
			const errorMessage = error.message || 'Failed to send OTP'
			res.status(500).json({
				failure:
					errorMessage.includes('SMTP') || errorMessage.includes('timeout')
						? 'Email service is not configured or timed out. Please contact support.'
						: 'Failed to send OTP. Please try again.',
			})
		}
	}
	async verifyOtp(req, res, next) {
		try {
			const { email, otp } = req.body
			const result = await mailService.verifyOtp(email, otp)
			res.json(result)
		} catch (error) {
			next(error)
		}
	}
}

module.exports = new OtpController()
