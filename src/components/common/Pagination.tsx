import React from "react";

export interface PaginationInfo {
	currentPage: number;
	pageSize: number;
	totalRecords?: number;
	totalPages?: number;
}

export interface PaginationProps {
	info: PaginationInfo;
	onPageChange: (page: number) => void;
	size?: "sm" | "md" | "lg";
	windowSize?: number;
	maxEdgePages?: number;
}

const Pagination: React.FC<PaginationProps> = ({ info, onPageChange, size = "md", windowSize = 4, maxEdgePages = 1 }) => {
	const { currentPage, totalPages = 0 } = info;

	// No pagination if only one page
	if (totalPages <= 1) {
		return null;
	}

	// Build array of page numbers to display based on window size
	const pages: (number | string)[] = [];

	const simpleThreshold = windowSize * 2 + maxEdgePages * 2 + 1;

	if (totalPages <= simpleThreshold) {
		// Small set: list every page
		for (let i = 1; i <= totalPages; i++) {
			pages.push(i);
		}
	} else {
		// Edges + window + ellipses
		const left = Math.max(currentPage - windowSize, maxEdgePages + 2);
		const right = Math.min(currentPage + windowSize, totalPages - maxEdgePages - 1);

		// Leading edge
		for (let i = 1; i <= maxEdgePages; i++) {
			pages.push(i);
		}
		if (left > maxEdgePages + 1) {
			pages.push("…");
		}

		// Window
		for (let i = left; i <= right; i++) {
			pages.push(i);
		}

		// Trailing ellipsis + edge
		if (right < totalPages - maxEdgePages) {
			pages.push("…");
		}
		for (let i = totalPages - maxEdgePages + 1; i <= totalPages; i++) {
			if (i > maxEdgePages) {
				pages.push(i);
			}
		}
	}

	const handlePageChange = (page: number) => (e: React.MouseEvent<HTMLAnchorElement>) => {
		e.preventDefault();
		onPageChange(page);
	};

	return (
		<nav aria-label="pagination">
			<ul className={`pagination pagination-${size}`}>
				{/* Previous button */}
				<li className={currentPage <= 1 ? "disabled" : ""}>
					<a
						href="#"
						role="button"
						aria-label="previous page"
						onClick={currentPage <= 1 ? undefined : handlePageChange(currentPage - 1)}
						tabIndex={currentPage <= 1 ? -1 : 0}>
						«
					</a>
				</li>

				{/* Page numbers */}
				{pages.map((page, index) => {
					if (page === "…") {
						return (
							<li key={`ellipsis-${index}`} className="disabled">
								<a aria-disabled="true">…</a>
							</li>
						);
					}

					const isActive = page === currentPage;
					return (
						<li key={`page-${page}`} className={isActive ? "active" : ""}>
							<a
								href="#"
								role="button"
								onClick={isActive ? undefined : handlePageChange(page as number)}
								aria-current={isActive ? "page" : undefined}>
								{page}
							</a>
						</li>
					);
				})}

				{/* Next button */}
				<li className={currentPage >= totalPages ? "disabled" : ""}>
					<a
						href="#"
						role="button"
						aria-label="next page"
						onClick={currentPage >= totalPages ? undefined : handlePageChange(currentPage + 1)}
						tabIndex={currentPage >= totalPages ? -1 : 0}>
						»
					</a>
				</li>
			</ul>
		</nav>
	);
};

export default Pagination;
