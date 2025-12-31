import React, { useState, useEffect, useCallback, useImperativeHandle } from "react";
import LoadingIndicator from "@components/common/LoadingIndicator";
import Pagination from "@components/common/Pagination";

export interface TableColumn<T = any> {
	key: string;
	label: string;
	sortEnabled?: boolean;
	className?: string;
	render?: (row: T) => React.ReactNode;
}

export interface TableSortState {
	key: string;
	direction: "asc" | "desc";
}

export interface PaginationOptions {
	page: number;
	pageSize: number;
}

export interface TableDataResponse<T> {
	results: T[];
	totalRecordCount?: number;
}

export interface TableEntryProps<T> {
	ref?: React.RefObject<TableEntryRef | null> | null;
	columns: TableColumn<T>[];
	fetchData: (sort?: TableSortState, pagination?: PaginationOptions) => Promise<TableDataResponse<T>>;
	caption?: string;
	className?: string;
	initialSortState?: TableSortState | null;
	loadingMessage?: string;
	createAction?: {
		label: string;
		onClick: () => void;
	};
	pagination?: {
		pageSize: number;
		controlSize: "sm" | "md" | "lg";
	};
}

export interface TableEntryRef {
	refresh: () => void;
}

export const TableEntry = <T extends { id?: string }>({
	ref,
	columns,
	fetchData,
	caption,
	className,
	initialSortState,
	loadingMessage = "Loading data...",
	createAction,
	pagination = { pageSize: 5, controlSize: "md" },
}: TableEntryProps<T>): React.ReactElement => {
	const [data, setData] = useState<T[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [hasLoadedOnce, setHasLoadedOnce] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [sortState, setSortState] = useState<TableSortState | null>(initialSortState || null);
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [totalRecords, setTotalRecords] = useState<number | undefined>(undefined);

	const totalPages = totalRecords ? Math.ceil(totalRecords / pagination.pageSize) : undefined;

	const loadData = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const paginationOptions: PaginationOptions = {
				page: currentPage,
				pageSize: pagination.pageSize,
			};

			const response = await fetchData(sortState || undefined, paginationOptions);
			setData(response.results);
			setTotalRecords(response.totalRecordCount);
			setHasLoadedOnce(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load data");
			console.error("Error fetching data:", err);
		} finally {
			setLoading(false);
		}
	}, [fetchData, sortState, currentPage, pagination.pageSize]);

	useEffect(() => {
		// Load data when dependencies change (sort, page, etc.) or first time
		loadData();
	}, [loadData]);

	useImperativeHandle(ref || null, () => ({
		refresh: loadData,
	}));

	const handleSort = (columnKey: string) => {
		setSortState((prev) => {
			if (prev?.key === columnKey) {
				return { key: columnKey, direction: prev.direction === "asc" ? "desc" : "asc" };
			}
			return { key: columnKey, direction: "asc" };
		});
		setCurrentPage(1);
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const renderCellValue = (row: T, column: TableColumn<T>) => {
		if (column.render) {
			return column.render(row);
		}
		const value = (row as any)[column.key];
		return value !== null && value !== undefined ? String(value) : "";
	};

	return (
		<div className="contextual-loading-container">
			<LoadingIndicator visible={loading} variant="contextual" message={loadingMessage} />

			{error && (
				<div className="error-message" role="alert">
					<p>{error}</p>
				</div>
			)}

			{createAction && (
				<div className="pull-right toolbar-actions mb-2">
					<div className="input-group pull-left">
						<button type="button" className="btn btn-primary" onClick={createAction.onClick}>
							{createAction.label}
						</button>
					</div>
				</div>
			)}

			<table role="grid" className={`table table-fluid table-header-bg table-hover ${className || ""}`.trim()}>
				{caption && <caption className="sr-only">{caption}</caption>}
				<thead>
					<tr>
						{columns.map((col) => {
							if (col.sortEnabled) {
								const isSorted = sortState?.key === col.key;
								const direction = sortState?.direction;
								return (
									<th key={col.key} className={`${col.className || ""} sort-enabled`} scope="col">
										<a
											href="#"
											role="button"
											aria-label={col.label}
											tabIndex={0}
											onClick={(e) => {
												e.preventDefault();
												handleSort(col.key);
											}}>
											{col.label}
											{isSorted && (
												<span
													className={`glyphicon ${direction === "asc" ? "glyphicon-arrow-up" : "glyphicon-arrow-down"}`}
													aria-hidden="true"></span>
											)}
										</a>
									</th>
								);
							}
							return (
								<th key={col.key} className={col.className || ""} scope="col">
									{col.label}
								</th>
							);
						})}
					</tr>
				</thead>
				<tbody>
					{data.length > 0 ? (
						data.map((row, i) => (
							<tr key={row.id || i}>
								{columns.map((col) => (
									<td key={col.key} className={col.className || ""}>
										{renderCellValue(row, col)}
									</td>
								))}
							</tr>
						))
					) : (
						<tr>
							<td colSpan={columns.length} className="no-data">
								{loading ? "" : "No data available"}
							</td>
						</tr>
					)}
				</tbody>
			</table>

			{totalPages && totalPages > 0 && (
				<Pagination
					info={{ currentPage, pageSize: pagination.pageSize, totalPages: totalPages, totalRecords }}
					onPageChange={handlePageChange}
					size={pagination.controlSize}
				/>
			)}
		</div>
	);
};

export default TableEntry;
