import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentPolicy } from '../../entities/content-policy.entity';
import { ContentReview } from '../../entities/content-review.entity';

export interface ContentPolicyConfig {
  projectId: string;
  ageRating: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17';
  themes: string[];
  tone: 'family' | 'mature' | 'dark' | 'lighthearted';
  violenceLevel: 'none' | 'mild' | 'moderate' | 'high';
  languageLevel: 'clean' | 'mild' | 'moderate' | 'strong';
  sexualContent: 'none' | 'mild' | 'moderate' | 'explicit';
  drugContent: 'none' | 'mild' | 'moderate' | 'explicit';
  politicalContent: 'none' | 'mild' | 'moderate' | 'explicit';
  customFilters: string[];
  autoReviewThreshold: number;
}

export interface ContentCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  requiresReview: boolean;
  reviewReason?: string;
  suggestedAgeRating?: string;
}

export interface ContentReviewRequest {
  contentId: string;
  contentType: 'story' | 'quest' | 'dialogue' | 'lore' | 'character';
  content: string;
  projectId: string;
  userId: string;
  isAIGenerated: boolean;
}

export interface ContentReviewResult {
  reviewId: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  reviewerId?: string;
  reviewNotes?: string;
  violations?: string[];
  approvedAt?: Date;
  rejectedAt?: Date;
}

@Injectable()
export class ContentPolicyService {
  private readonly logger = new Logger(ContentPolicyService.name);

  constructor(
    @InjectRepository(ContentPolicy)
    private contentPolicyRepository: Repository<ContentPolicy>,
    @InjectRepository(ContentReview)
    private contentReviewRepository: Repository<ContentReview>,
  ) {}

  /**
   * Create or update content policy for a project
   */
  async setContentPolicy(config: ContentPolicyConfig): Promise<ContentPolicy> {
    try {
      let policy = await this.contentPolicyRepository.findOne({
        where: { projectId: config.projectId },
      });

      if (policy) {
        // Update existing policy
        Object.assign(policy, config);
      } else {
        // Create new policy
        policy = this.contentPolicyRepository.create(config);
      }

      await this.contentPolicyRepository.save(policy);

      this.logger.log(`Content policy updated for project ${config.projectId}`);

      return policy;
    } catch (error) {
      this.logger.error(`Failed to set content policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get content policy for a project
   */
  async getContentPolicy(projectId: string): Promise<ContentPolicy | null> {
    try {
      return await this.contentPolicyRepository.findOne({
        where: { projectId },
      });
    } catch (error) {
      this.logger.error(`Failed to get content policy: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check content against policy
   */
  async checkContent(
    content: string,
    projectId: string,
    contentType: string,
  ): Promise<ContentCheckResult> {
    try {
      const policy = await this.getContentPolicy(projectId);
      if (!policy) {
        // No policy set, allow content
        return {
          passed: true,
          violations: [],
          warnings: [],
          requiresReview: false,
        };
      }

      const violations: string[] = [];
      const warnings: string[] = [];
      let requiresReview = false;
      let reviewReason: string | undefined;

      // Check age rating compliance
      const ageRatingCheck = this.checkAgeRating(content, policy.ageRating);
      violations.push(...ageRatingCheck.violations);
      warnings.push(...ageRatingCheck.warnings);

      // Check theme compliance
      const themeCheck = this.checkThemes(content, policy.themes);
      violations.push(...themeCheck.violations);
      warnings.push(...themeCheck.warnings);

      // Check violence level
      const violenceCheck = this.checkViolenceLevel(content, policy.violenceLevel);
      violations.push(...violenceCheck.violations);
      warnings.push(...violenceCheck.warnings);

      // Check language level
      const languageCheck = this.checkLanguageLevel(content, policy.languageLevel);
      violations.push(...languageCheck.violations);
      warnings.push(...languageCheck.warnings);

      // Check sexual content
      const sexualCheck = this.checkSexualContent(content, policy.sexualContent);
      violations.push(...sexualCheck.violations);
      warnings.push(...sexualCheck.warnings);

      // Check drug content
      const drugCheck = this.checkDrugContent(content, policy.drugContent);
      violations.push(...drugCheck.violations);
      warnings.push(...drugCheck.warnings);

      // Check political content
      const politicalCheck = this.checkPoliticalContent(content, policy.politicalContent);
      violations.push(...politicalCheck.violations);
      warnings.push(...politicalCheck.warnings);

      // Check custom filters
      const customCheck = this.checkCustomFilters(content, policy.customFilters);
      violations.push(...customCheck.violations);
      warnings.push(...customCheck.warnings);

      // Determine if review is required
      if (violations.length > 0) {
        requiresReview = true;
        reviewReason = `Content violates policy: ${violations.join(', ')}`;
      } else if (warnings.length >= policy.autoReviewThreshold) {
        requiresReview = true;
        reviewReason = `Content has ${warnings.length} warnings, exceeds threshold of ${policy.autoReviewThreshold}`;
      }

      // Suggest age rating based on content analysis
      const suggestedAgeRating = this.suggestAgeRating(content, violations, warnings);

      return {
        passed: violations.length === 0,
        violations,
        warnings,
        requiresReview,
        reviewReason,
        suggestedAgeRating,
      };
    } catch (error) {
      this.logger.error(`Failed to check content: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Submit content for review
   */
  async submitForReview(request: ContentReviewRequest): Promise<ContentReviewResult> {
    try {
      // Check content against policy first
      const checkResult = await this.checkContent(
        request.content,
        request.projectId,
        request.contentType,
      );

      // Create review record
      const review = this.contentReviewRepository.create({
        contentId: request.contentId,
        contentType: request.contentType,
        content: request.content,
        projectId: request.projectId,
        submittedBy: request.userId,
        isAIGenerated: request.isAIGenerated,
        status: 'pending',
        violations: checkResult.violations,
        warnings: checkResult.warnings,
        reviewReason: checkResult.reviewReason,
        suggestedAgeRating: checkResult.suggestedAgeRating,
      });

      await this.contentReviewRepository.save(review);

      this.logger.log(`Content review submitted: ${review.id} for project ${request.projectId}`);

      return {
        reviewId: review.id,
        status: review.status,
        violations: review.violations,
      };
    } catch (error) {
      this.logger.error(`Failed to submit content for review: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Review content (approve/reject)
   */
  async reviewContent(
    reviewId: string,
    reviewerId: string,
    status: 'approved' | 'rejected' | 'flagged',
    reviewNotes?: string,
  ): Promise<ContentReviewResult> {
    try {
      const review = await this.contentReviewRepository.findOne({
        where: { id: reviewId },
      });

      if (!review) {
        throw new Error('Review not found');
      }

      review.status = status;
      review.reviewerId = reviewerId;
      review.reviewNotes = reviewNotes;

      if (status === 'approved') {
        review.approvedAt = new Date();
      } else if (status === 'rejected') {
        review.rejectedAt = new Date();
      }

      await this.contentReviewRepository.save(review);

      this.logger.log(`Content review ${status}: ${reviewId} by reviewer ${reviewerId}`);

      return {
        reviewId: review.id,
        status: review.status,
        reviewerId: review.reviewerId,
        reviewNotes: review.reviewNotes,
        violations: review.violations,
        approvedAt: review.approvedAt,
        rejectedAt: review.rejectedAt,
      };
    } catch (error) {
      this.logger.error(`Failed to review content: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get review queue for a project
   */
  async getReviewQueue(projectId: string): Promise<ContentReview[]> {
    try {
      return await this.contentReviewRepository.find({
        where: { projectId, status: 'pending' },
        order: { createdAt: 'ASC' },
      });
    } catch (error) {
      this.logger.error(`Failed to get review queue: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Check age rating compliance
   */
  private checkAgeRating(content: string, allowedRating: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Define age rating keywords and phrases
    const ageRatingContent = {
      G: { keywords: [], maxViolence: 0, maxLanguage: 0 },
      PG: { keywords: ['mild violence', 'some scary scenes'], maxViolence: 1, maxLanguage: 1 },
      'PG-13': { keywords: ['violence', 'language', 'suggestive content'], maxViolence: 2, maxLanguage: 2 },
      R: { keywords: ['strong violence', 'language', 'sexual content'], maxViolence: 3, maxLanguage: 3 },
      'NC-17': { keywords: ['explicit content', 'graphic violence'], maxViolence: 4, maxLanguage: 4 },
    };

    const rating = ageRatingContent[allowedRating];
    if (!rating) return { violations, warnings };

    // Check for age-inappropriate content
    const lowerContent = content.toLowerCase();
    const violenceCount = (lowerContent.match(/violence|fight|kill|death|blood/g) || []).length;
    const languageCount = (lowerContent.match(/damn|hell|shit|fuck|ass/g) || []).length;

    if (violenceCount > rating.maxViolence) {
      violations.push(`Violence level exceeds ${allowedRating} rating`);
    }

    if (languageCount > rating.maxLanguage) {
      violations.push(`Language level exceeds ${allowedRating} rating`);
    }

    return { violations, warnings };
  }

  /**
   * Check theme compliance
   */
  private checkThemes(content: string, allowedThemes: string[]): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    // This is a simplified implementation
    // In production, you'd want more sophisticated theme detection
    const contentThemes = this.detectThemes(content);
    const disallowedThemes = contentThemes.filter(theme => !allowedThemes.includes(theme));

    if (disallowedThemes.length > 0) {
      violations.push(`Content contains disallowed themes: ${disallowedThemes.join(', ')}`);
    }

    return { violations, warnings };
  }

  /**
   * Check violence level
   */
  private checkViolenceLevel(content: string, allowedLevel: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const violenceKeywords = {
      none: [],
      mild: ['fight', 'punch', 'kick'],
      moderate: ['violence', 'battle', 'war', 'blood'],
      high: ['gore', 'torture', 'murder', 'slaughter'],
    };

    const keywords = violenceKeywords[allowedLevel] || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        violations.push(`Content contains ${allowedLevel} violence keyword: ${keyword}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Check language level
   */
  private checkLanguageLevel(content: string, allowedLevel: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const languageKeywords = {
      clean: [],
      mild: ['damn', 'hell'],
      moderate: ['shit', 'ass', 'bitch'],
      strong: ['fuck', 'cunt', 'cock', 'pussy'],
    };

    const keywords = languageKeywords[allowedLevel] || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        violations.push(`Content contains ${allowedLevel} language: ${keyword}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Check sexual content
   */
  private checkSexualContent(content: string, allowedLevel: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const sexualKeywords = {
      none: [],
      mild: ['romance', 'kiss', 'love'],
      moderate: ['sexual', 'intimate', 'passion'],
      explicit: ['sex', 'nude', 'penetration', 'orgasm'],
    };

    const keywords = sexualKeywords[allowedLevel] || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        violations.push(`Content contains ${allowedLevel} sexual content: ${keyword}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Check drug content
   */
  private checkDrugContent(content: string, allowedLevel: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const drugKeywords = {
      none: [],
      mild: ['alcohol', 'wine', 'beer'],
      moderate: ['drugs', 'marijuana', 'cocaine'],
      explicit: ['heroin', 'meth', 'injection'],
    };

    const keywords = drugKeywords[allowedLevel] || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        violations.push(`Content contains ${allowedLevel} drug content: ${keyword}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Check political content
   */
  private checkPoliticalContent(content: string, allowedLevel: string): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const politicalKeywords = {
      none: [],
      mild: ['government', 'politics'],
      moderate: ['election', 'campaign', 'policy'],
      explicit: ['protest', 'revolution', 'coup'],
    };

    const keywords = politicalKeywords[allowedLevel] || [];
    const lowerContent = content.toLowerCase();

    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        violations.push(`Content contains ${allowedLevel} political content: ${keyword}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Check custom filters
   */
  private checkCustomFilters(content: string, customFilters: string[]): {
    violations: string[];
    warnings: string[];
  } {
    const violations: string[] = [];
    const warnings: string[] = [];

    const lowerContent = content.toLowerCase();

    for (const filter of customFilters) {
      if (lowerContent.includes(filter.toLowerCase())) {
        violations.push(`Content contains custom filter: ${filter}`);
      }
    }

    return { violations, warnings };
  }

  /**
   * Detect themes in content
   */
  private detectThemes(content: string): string[] {
    // Simplified theme detection
    // In production, you'd want more sophisticated NLP-based theme detection
    const themes: string[] = [];
    const lowerContent = content.toLowerCase();

    if (lowerContent.includes('fantasy') || lowerContent.includes('magic')) {
      themes.push('fantasy');
    }

    if (lowerContent.includes('sci-fi') || lowerContent.includes('space')) {
      themes.push('sci-fi');
    }

    if (lowerContent.includes('horror') || lowerContent.includes('scary')) {
      themes.push('horror');
    }

    if (lowerContent.includes('romance') || lowerContent.includes('love')) {
      themes.push('romance');
    }

    if (lowerContent.includes('action') || lowerContent.includes('adventure')) {
      themes.push('action');
    }

    return themes;
  }

  /**
   * Suggest age rating based on content analysis
   */
  private suggestAgeRating(
    content: string,
    violations: string[],
    warnings: string[],
  ): string {
    if (violations.length === 0 && warnings.length === 0) {
      return 'G';
    }

    if (violations.some(v => v.includes('explicit') || v.includes('graphic'))) {
      return 'NC-17';
    }

    if (violations.some(v => v.includes('strong') || v.includes('moderate'))) {
      return 'R';
    }

    if (violations.length > 0 || warnings.length > 3) {
      return 'PG-13';
    }

    return 'PG';
  }
}
