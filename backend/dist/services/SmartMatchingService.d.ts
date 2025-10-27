interface Provider {
    id: string;
    business_name: string;
    service_category: string;
    city: string;
    neighborhood: string;
    rating: number;
    total_reviews: number;
    experience_years: number;
    hourly_rate: number;
    phone_number: string;
    email: string;
    first_name: string;
    last_name: string;
    is_available: boolean;
    last_active: string;
}
interface Case {
    id: string;
    service_type: string;
    category: string;
    city?: string;
    neighborhood?: string;
    priority: string;
    preferred_date?: string;
    created_at: string;
}
interface ProviderScore {
    provider: Provider;
    score: number;
    factors: {
        categoryMatch: number;
        locationMatch: number;
        ratingScore: number;
        availabilityScore: number;
        experienceScore: number;
        priceScore: number;
        responseTimeScore: number;
    };
}
export declare class SmartMatchingService {
    private db;
    constructor();
    findBestProviders(caseData: Case, limit?: number): Promise<ProviderScore[]>;
    private getEligibleProviders;
    private calculateProviderScore;
    private calculateCategoryMatch;
    private calculateLocationMatch;
    private calculateRatingScore;
    private calculateAvailabilityScore;
    private calculateExperienceScore;
    private calculatePriceScore;
    private calculateResponseTimeScore;
    autoAssignCase(caseId: string): Promise<string | null>;
}
export default SmartMatchingService;
//# sourceMappingURL=SmartMatchingService.d.ts.map