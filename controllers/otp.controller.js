const mailService = require('../services/mail.service')

class OtpController {
	async sendOtp(req, res, next) {
		try {
			const { email } = req.body
			if (!email) {
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
				await Promise.race([mailService.sendOtpMail(email), timeoutPromise])
				clearTimeout(timeoutId)
			} catch (error) {
				clearTimeout(timeoutId)
				throw error
			}

			res.json({ status: 200 })
		} catch (error) {
			console.error('OTP send error:', error)
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
