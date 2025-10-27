import { Request, Response } from 'express';
export declare const createReview: (req: Request, res: Response) => Promise<void>;
export declare const getProviderReviews: (req: Request, res: Response) => Promise<void>;
export declare const getProviderReviewStats: (req: Request, res: Response) => Promise<void>;
export declare const canReviewCase: (req: Request, res: Response) => Promise<void>;
export declare const getPendingReviews: (req: Request, res: Response) => Promise<void>;
export declare const updateProviderRating: (req: Request, res: Response) => Promise<void>;
export declare const sendReviewRequest: (req: Request, res: Response) => Promise<void>;
//# sourceMappingURL=reviewController.d.ts.map