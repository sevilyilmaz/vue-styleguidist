import { detect } from 'detect-browser'

const browser = detect()

export default function getTargetFromBrowser(): string {
	return browser ? `${browser.name}${browser.version}` : 'node9'
}
