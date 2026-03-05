import { useState, useCallback, useRef, useEffect } from "react";

interface Position {
	x: number;
	y: number;
}

export function useDraggable(initialPosition: Position = { x: 20, y: 20 }) {
	const [position, setPosition] = useState<Position>(() => {
		const saved = localStorage.getItem("devConsole:position");
		return saved ? JSON.parse(saved) : initialPosition;
	});

	const dragging = useRef(false);
	const offset = useRef({ x: 0, y: 0 });

	const onMouseDown = useCallback(
		(e: { clientX: number; clientY: number; preventDefault: () => void }) => {
			dragging.current = true;
			offset.current = {
				x: e.clientX - position.x,
				y: e.clientY - position.y,
			};
			e.preventDefault();
		},
		[position]
	);

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			if (!dragging.current) return;
			const newPos = {
				x: e.clientX - offset.current.x,
				y: e.clientY - offset.current.y,
			};
			setPosition(newPos);
		};

		const onMouseUp = () => {
			if (dragging.current) {
				dragging.current = false;
				localStorage.setItem("devConsole:position", JSON.stringify(position));
			}
		};

		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);
		return () => {
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
		};
	}, [position]);

	return { position, onMouseDown };
}
