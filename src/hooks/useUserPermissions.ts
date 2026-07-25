
import { useAuth } from '@/hooks/useAuth';
import { useUsuariosTimes } from "./useTimes";
import { useMemo } from "react";

export const useUserPermissions = () => {
  const { user } = useAuth();
  const { usuariosTimes } = useUsuariosTimes();

  const basePermissions = useMemo(() => {
    if (!user?.profile) {
      return {
        isAdmin: false,
        isManager: false,
        isManagerStrict: false,
        isUser: false,
        isComercial: false,
        isGestor: false,
        isConsultor: false,
        isSuperAdmin: false,
        isCliente: false,
        currentUserId: null,
        currentUserName: "",
        isValid: false,
        isProvisional: false,
      };
    }

    const isAdmin = user.profile.user_type === 'admin';
    // isManagerStrict: manager legado OU gestor_comercial Altiora (migration 20260725110000)
    const isManagerStrict = user.profile.user_type === 'manager'
      || user.profile.user_type === 'gestor_comercial';
    const isUser = user.profile.user_type === 'user';
    // isComercial: comercial legado OU closer Altiora (migration 20260725110000)
    const isComercial = user.profile.user_type === 'comercial'
      || user.profile.user_type === 'closer';
    // isManager preserves legacy capability semantics ("can manage") — admin OR manager.
    // For the strict role check use isManagerStrict, isAdmin, isUser, or isComercial.
    const isManager = isAdmin || isManagerStrict;
    const isGestor = isManager;
    const isSuperAdmin = isAdmin;
    const isConsultor = false;
    const isCliente = false;
    const currentUserId = user.profile.id;
    const currentUserName = user.profile.nome || "";
    const isProvisional = user.profile.isProvisional === true;

    if (!currentUserId) {
      return {
        isAdmin: false,
        isManager: false,
        isManagerStrict: false,
        isUser: false,
        isComercial: false,
        isGestor: false,
        isConsultor: false,
        isSuperAdmin: false,
        isCliente: false,
        currentUserId: null,
        currentUserName: "",
        isValid: false,
        isProvisional: false,
      };
    }

    return {
      isAdmin,
      isManager,
      isManagerStrict,
      isUser,
      isComercial,
      isGestor,
      isConsultor,
      isSuperAdmin,
      isCliente,
      currentUserId,
      currentUserName,
      isValid: true,
      isProvisional,
    };
  }, [user?.profile]);

  const canManage = basePermissions.isManager;

  const userTimes = useMemo(() => {
    if (!usuariosTimes || !basePermissions.currentUserId) return [];
    return usuariosTimes
      .filter(ut => ut.usuario_id === basePermissions.currentUserId)
      .map(ut => ut.time_id);
  }, [usuariosTimes, basePermissions.currentUserId]);

  const filterFunctions = useMemo(() => {
    const getResponsavelFilter = () => {
      if (!basePermissions.isValid || basePermissions.isProvisional) return "__INVALID_USER__";
      if (canManage) return "";
      // 'comercial' é restrito por PIPELINE (via equipe → settings_teams_pipelines,
      // ver usePipelines/useMyAllowedPipelineIds), não por atribuição individual do
      // lead — a maioria dos leads não tem user_id setado, então filtrar por
      // "responsável = eu" deixaria tudo invisível pra esse perfil.
      if (basePermissions.isComercial) return "";
      return basePermissions.currentUserId;
    };

    const getTeamFilter = () => {
      if (!basePermissions.isValid || basePermissions.isProvisional) return "__INVALID_USER__";
      if (canManage) return "";
      // Mesmo motivo do getResponsavelFilter acima — leads também raramente têm
      // teams_id setado; a restrição de 'comercial' já vem do filtro de pipeline.
      if (basePermissions.isComercial) return "";
      if (basePermissions.isUser && userTimes.length > 0) return userTimes;
      return "";
    };

    return { getResponsavelFilter, getTeamFilter };
  }, [canManage, basePermissions.currentUserId, basePermissions.isValid, basePermissions.isProvisional, basePermissions.isComercial, basePermissions.isUser, userTimes]);

  const isProvisional = basePermissions.isProvisional;

  return {
    ...basePermissions,
    userTimes,
    isProvisional,
    canChangeFilters: !isProvisional && canManage,
    canBlockSchedule: !isProvisional && canManage,
    canBlockOwnSchedule: !isProvisional,
    canCreateUser: !isProvisional && canManage,
    canEditUser: !isProvisional && canManage,
    canDeleteUser: !isProvisional && canManage,
    canCreateClient: !isProvisional && canManage,
    canEditClient: !isProvisional && canManage,
    canDeleteClient: !isProvisional && canManage,
    canAccessCRM: true,
    canAccessFullProjects: true,
    canAccessSettings: !isProvisional && canManage,
    ...filterFunctions,
  };
};
