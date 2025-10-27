interface Review {
    id: string;
    case_id: string;
    customer_id: string;
    provider_id: string;
    rating: number;
    comment?: string;
    service_quality: number;
    communication: number;
    timeliness: number;
    value_for_money: number;
    would_recommend: boolean;
    created_at: string;
    updated_at: string;
}
interface ReviewStats {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: {
        [key: number]: number;
    };
    categoryAverages: {
        serviceQuality: number;
        communication: number;
        timeliness: number;
        valueForMoney: number;
    };
    recommendationRate: number;
}
export declare class ReviewService {
    private db;
    private notificationService;
    constructor();
    private initializeReviewTables;
    createReview(reviewData: {
        caseId: string;
        customerId: string;
        providerId: string;
        rating: number;
        comment?: string;
        serviceQuality?: number;
        communication?: number;
        timeliness?: number;
        valueForMoney?: number;
        wouldRecommend?: boolean;
    }): Promise<string>;
    getProviderReviews(providerId: string, page?: number, limit?: number): Promise<{
        reviews: Review[];
        total: number;
    }>;
    getProviderReviewStats(providerId: string): Promise<ReviewStats>;
    canReviewCase(caseId: string, customerId: string): Promise<boolean>;
    getPendingReviews(customerId: string): Promise<any[]>;
    sendReviewRequest(caseId: string, customerId: string, providerName: string): Promise<void>;
    updateProviderRating(providerId: string): Promise<void>;
}
export default ReviewService;
//# sourceMappingURL=ReviewService.d.ts.map