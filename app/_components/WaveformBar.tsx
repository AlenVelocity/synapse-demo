'use client'

import { motion } from 'framer-motion'

// Waveform animation component
export function WaveformBar({ isListening, delay }: { isListening: boolean; delay: number }) {
	return (
		<motion.div
			initial={{ height: '10px' }}
			animate={
				isListening
					? {
							height: ['10px', '20px', '10px', '15px', '10px'],
							transition: {
								duration: 1,
								repeat: Number.POSITIVE_INFINITY,
								delay: delay
							}
						}
					: { height: '10px' }
			}
			className="w-1 bg-red-500 rounded-full"
		/>
	)
}
