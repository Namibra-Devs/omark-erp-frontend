// src/types/api.ts
// This file is auto-generated from openapi.json. Do not edit directly.

/**
 * UserEntity
 */
export interface UserEntity {
  id: number;
  name: string;
  email: string;
  phone?: Record<string, any> | null;
  role: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * LoginResponseEntity
 */
export interface LoginResponseEntity {
  success: boolean;
  user: UserEntity;
  accessToken: string;
  refreshToken: string;
}

/**
 * RegisterResponseEntity
 */
export interface RegisterResponseEntity {
  success: boolean;
  user: UserEntity;
}

/**
 * TokenRefreshResponseEntity
 */
export interface TokenRefreshResponseEntity {
  success: boolean;
  accessToken: string;
  refreshToken: string;
}

/**
 * LoginDto
 */
export interface LoginDto {
  /** Admin email address */
  email: string;
  /** Admin password */
  password: string;
  /** Keep session alive longer */
  rememberMe?: boolean;
}

/**
 * RegisterDto
 */
export interface RegisterDto {
  /** Full name of the admin user */
  fullName: string;
  /** Unique email address */
  email: string;
  /** Phone number */
  phone?: string;
  /** Password — must contain uppercase, lowercase and a number */
  password: string;
  /** Must match password */
  confirmPassword: string;
  /** Must be true to complete registration */
  agreeTerms: boolean;
}

/**
 * RefreshTokenDto
 */
export interface RefreshTokenDto {
  /** Refresh token */
  refreshToken: string;
}

/**
 * ForgotPasswordDto
 */
export interface ForgotPasswordDto {
  email: string;
}

/**
 * ResetPasswordDto
 */
export interface ResetPasswordDto {
  /** Reset token from email */
  token: string;
  password: string;
  confirmPassword: string;
}

/**
 * UpdateProfileDto
 */
export interface UpdateProfileDto {
  name?: string;
  phone?: string;
}

/**
 * PaginationMeta
 */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

/**
 * ProjectEntity
 */
export interface ProjectEntity {
  id: number;
  title: string;
  description: string;
  location: string;
  status: string;
  category: string;
  image: string;
  completion: string;
  units: string;
  size: string;
  completionDate: string;
  features: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * ProjectGalleryImageEntity
 */
export interface ProjectGalleryImageEntity {
  id: number;
  projectId: number;
  /** Image or video URL */
  url: string;
  caption?: Record<string, any> | null;
  mediaType: string;
  order: number;
}

/**
 * ProjectWithGalleryEntity
 */
export interface ProjectWithGalleryEntity {
  id: number;
  title: string;
  description: string;
  location: string;
  status: string;
  category: string;
  image: string;
  completion: string;
  units: string;
  size: string;
  completionDate: string;
  features: string[];
  featured: boolean;
  createdAt: string;
  updatedAt: string;
  gallery: ProjectGalleryImageEntity[];
}

/**
 * EventEntity
 */
export interface EventEntity {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  category: string;
  image: string;
  status: string;
  featured: boolean;
  maxAttendees?: Record<string, any> | null;
  currentRegistrations: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * RegistrationEntity
 */
export interface RegistrationEntity {
  id: number;
  eventId: number;
  name: string;
  email: string;
  phone: string;
  guests: number;
  specialRequests?: Record<string, any> | null;
  registeredAt: string;
}

/**
 * RegisterEventDto
 */
export interface RegisterEventDto {
  /** Full name of the attendee */
  name: string;
  /** Attendee email address */
  email: string;
  /** Attendee phone number */
  phone: string;
  /** Number of additional guests (0 = just yourself) */
  guests?: number;
  /** Dietary restrictions, accessibility needs, etc. */
  specialRequests?: string;
}

/**
 * GalleryItemEntity
 */
export interface GalleryItemEntity {
  id: number;
  title: string;
  category: string;
  /** Image or video URL */
  image: string;
  mediaType: string;
  tags: string[];
  date: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * GalleryItemWithUrlDto
 */
export interface GalleryItemWithUrlDto {
  title: string;
  category: string;
  image: string;
  tags?: string[];
}

/**
 * BulkCreateGalleryDto
 */
export interface BulkCreateGalleryDto {
  items: GalleryItemWithUrlDto[];
}

/**
 * HeroSlideEntity
 */
export interface HeroSlideEntity {
  id: number;
  image: string;
  badge?: Record<string, any>;
  title: string;
  highlight?: Record<string, any>;
  subtitle: string;
  btn1Text?: Record<string, any>;
  btn1Link?: Record<string, any>;
  btn2Text?: Record<string, any>;
  btn2Link?: Record<string, any>;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * NewsArticleEntity
 */
export interface NewsArticleEntity {
  id: number;
  title: string;
  excerpt: string;
  content?: Record<string, any> | null;
  category: string;
  image: string;
  date: string;
  author: string;
  readTime: string;
  views: number;
  likes: number;
  featured: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * JobEntity
 */
export interface JobEntity {
  id: number;
  title: string;
  department: string;
  location: string;
  type: string;
  salary: string;
  experience: string;
  description: string;
  requirements: string[];
  benefits: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * JobApplicationEntity
 */
export interface JobApplicationEntity {
  id: number;
  jobId: number;
  fullName: string;
  email: string;
  phone: string;
  coverLetter: string;
  resumeUrl: string;
  status: string;
  appliedAt?: string;
}

/**
 * CreateJobDto
 */
export interface CreateJobDto {
  title: string;
  department: string;
  location: string;
  type: string;
  salary: string;
  experience: string;
  description: string;
  requirements?: string[];
  benefits?: string[];
  active?: boolean;
}

/**
 * UpdateJobDto
 */
export interface UpdateJobDto {
}

/**
 * UpdateApplicationStatusDto
 */
export interface UpdateApplicationStatusDto {
  status: string;
}

/**
 * ContactMessageEntity
 */
export interface ContactMessageEntity {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: Record<string, any> | null;
  interest: string;
  message: string;
  preferredContact: string;
  status: string;
  createdAt: string;
}

/**
 * CreateContactDto
 */
export interface CreateContactDto {
  /** First name */
  firstName: string;
  /** Last name */
  lastName: string;
  /** Email address */
  email: string;
  /** Phone number */
  phone?: string;
  /** Area of interest */
  interest: string;
  message: string;
  /** Preferred contact method */
  preferredContact?: string;
}

/**
 * UpdateContactStatusDto
 */
export interface UpdateContactStatusDto {
  status: string;
}

/**
 * ProgramEntity
 */
export interface ProgramEntity {
  id: number;
  title: string;
  description: string;
  category: string;
  image: string;
  duration: string;
  schedule: string;
  location: string;
  maxAttendees?: Record<string, any> | null;
  price?: Record<string, any> | null;
  status: string;
  featured: boolean;
  currentRegistrations: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * ProgramRegistrationEntity
 */
export interface ProgramRegistrationEntity {
  id: number;
  programId: number;
  name: string;
  email: string;
  phone: string;
  registeredAt: string;
}

/**
 * RegisterProgramDto
 */
export interface RegisterProgramDto {
  name: string;
  email: string;
  phone: string;
  message?: string;
}

/**
 * NewsletterSubscriberEntity
 */
export interface NewsletterSubscriberEntity {
  id: number;
  email: string;
  active: boolean;
  unsubscribeToken: string;
  subscribedAt: string;
  updatedAt: string;
}

/**
 * SubscribeDto
 */
export interface SubscribeDto {
  email: string;
  name?: string;
}

/**
 * SendNewsletterDto
 */
export interface SendNewsletterDto {
  subject: string;
  html: string;
}

/**
 * TestimonialEntity
 */
export interface TestimonialEntity {
  id: number;
  name: string;
  role: string;
  company?: Record<string, any> | null;
  image?: Record<string, any> | null;
  content: string;
  rating: number;
  featured: boolean;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * FaqEntity
 */
export interface FaqEntity {
  id: number;
  question: string;
  answer: string;
  category: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * CreateFaqDto
 */
export interface CreateFaqDto {
  question: string;
  answer: string;
  category?: string;
  order?: number;
  active?: boolean;
}

/**
 * UpdateFaqDto
 */
export interface UpdateFaqDto {
}

