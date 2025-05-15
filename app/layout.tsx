import type React from 'react'
import '@/app/globals.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { DeepgramContextProvider } from '@/context/DeepgramContextProvider'
import { MicrophoneContextProvider } from '@/context/MicrophoneContextProvider'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
	title: 'Synapse',
	description: 'Real-time speech-to-text transcriber',
	viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={inter.className}>
				<ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
					<MicrophoneContextProvider>
						<DeepgramContextProvider>{children}</DeepgramContextProvider>
					</MicrophoneContextProvider>
				</ThemeProvider>
				<Toaster position="bottom-center" />
			</body>
		</html>
	)
}
