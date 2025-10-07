// うめはら
import { NextResponse } from 'next/server';
import path from 'path';
import { exec } from 'child_process';

const SCRIPT_PATH = path.resolve(
	process.cwd(),
	'src/app/api/cart/checkout/aeon_netsuper_cart.py'
);

export async function POST(_req: Request) {
	try {
		const command = `python3 ${SCRIPT_PATH}`
		const { stdout, stderr } = await execPromise(command);

		if (stderr) {
			return NextResponse.json(
				{ error: 'Checkout script failed.', details: stderr.trim() },
			);
		}
		return NextResponse.json({
			msg: 'success',
		});

	} catch { 
		return NextResponse.json(
			// error msg
			{ error: 'Python script not found' },
			{ status: 500 }
		);
	}
}

